/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.saidone.mindmaps.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.dto.NodeDto;
import org.saidone.mindmaps.dto.MapGenerationRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.ArrayList;
import java.util.Arrays;

@Service
@RequiredArgsConstructor
@Slf4j
public class MapGenerationApplicationService {

    private final MapGenerationService mapGenerationService;

    @Value("${app.ai.generation.max-attachment-chars:60000}")
    private int maxAttachmentChars;

    @Value("${app.ai.generation.max-attempts:2}")
    private int maxAttempts;

    public MindMapDto generateMindMap(MapGenerationRequestDto request) {
        return generateMindMap(request, GenerationProgress.NONE);
    }

    public MindMapDto generateMindMap(MapGenerationRequestDto request, GenerationProgress progress) {
        validateRequestLimits(request);

        applyReferenceTextLimit(request);
        int attempts = Math.max(1, maxAttempts);

        RuntimeException lastError = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                progress.update(i == 1 ? "Sto creando la mappa con l’AI…"
                        : String.format("Sto riprovando a creare la mappa (tentativo %d di %d)…", i, attempts), 0, 0);
                val generated = mapGenerationService.generateMindMap(request);
                progress.update("Sto controllando i nodi e i collegamenti della mappa…", 0, 0);
                sanitize(generated);
                enforceDepth(generated, request.getMaxDepth());
                return generated;
            } catch (RuntimeException ex) {
                lastError = ex;
                log.warn("Tentativo generazione mindmap {} di {} fallito", i, attempts, ex);
            }
        }
        if (lastError != null && StringUtils.hasText(lastError.getMessage())) {
            throw new IllegalStateException(lastError.getMessage(), lastError);
        }
        throw new IllegalStateException("Impossibile generare la mindmap con l'AI al momento.", lastError);
    }

    private void validateRequestLimits(MapGenerationRequestDto request) {
        if (request == null) {
            throw new IllegalStateException("Richiesta di generazione non valida.");
        }
        if (!StringUtils.hasText(request.getTopic())) {
            throw new IllegalStateException("Inserisci un argomento o una breve descrizione.");
        }
        request.setTopic(request.getTopic().trim());
        if (request.getMaxDepth() == null) {
            request.setMaxDepth(3);
        }
        request.setMaxDepth(Math.clamp(request.getMaxDepth(), 2, 6));
    }

    private void applyReferenceTextLimit(MapGenerationRequestDto request) {
        if (!StringUtils.hasText(request.getReferenceText())) {
            request.setReferenceText(null);
            return;
        }
        int effectiveMaxAttachmentChars = maxAttachmentChars > 0 ? maxAttachmentChars : 30000;
        val truncated = request.getReferenceText().substring(0, Math.min(effectiveMaxAttachmentChars, request.getReferenceText().length()));
        request.setReferenceText(truncated);
    }

    private void sanitize(MindMapDto generated) {
        if (generated == null || generated.getNodes() == null || generated.getNodes().isEmpty()) {
            throw new IllegalStateException("L'IA non ha generato una mindmap valida.");
        }
        if (!StringUtils.hasText(generated.getTitle())) {
            generated.setTitle("Mindmap generata dall'IA");
        }
        val prizes = generated.getPrizes();
        if (prizes == null || prizes.size() != 5
                || prizes.stream().anyMatch(prize -> !StringUtils.hasText(prize) || prize.strip().length() > 120)
                || prizes.stream().map(prize -> prize.strip().toLowerCase(java.util.Locale.ROOT)).distinct().count() != 5) {
            throw new IllegalStateException("L'AI non ha generato cinque titoli premio validi e diversi.");
        }
        generated.setPrizes(prizes.stream().map(String::strip).toList());

        val original = generated.getNodes();
        if (!hasValidNode(original.getFirst())) {
            throw new IllegalStateException("L’AI non ha generato un nodo principale valido.");
        }
        val indices = new int[original.size()];
        Arrays.fill(indices, -1);
        val retained = new ArrayList<NodeDto>();
        for (int i = 0; i < original.size(); i++) {
            if (!hasValidNode(original.get(i))) continue;
            indices[i] = retained.size();
            retained.add(normalizeNodeDescription(original.get(i)));
        }
        for (int i = 0; i < original.size(); i++) {
            if (indices[i] < 0) continue;
            val node = original.get(i);
            if (i == 0) {
                node.setParentId(null);
                continue;
            }
            Long parent = node.getParentId();
            int cursor = i;
            // References use the original indices. Skip discarded ancestors without
            // ever interpreting an old index as an index into the compacted list.
            while (parent != null) {
                if (parent < 0 || parent >= cursor) {
                    throw new IllegalStateException("L’AI ha generato collegamenti tra nodi non validi.");
                }
                val index = parent.intValue();
                if (indices[index] >= 0) break;
                val ancestor = original.get(index);
                if (ancestor == null) {
                    throw new IllegalStateException("L’AI ha collegato un nodo a un genitore mancante.");
                }
                cursor = index;
                parent = ancestor.getParentId();
            }
            node.setParentId(parent == null ? 0L : (long) indices[parent.intValue()]);
        }
        generated.setNodes(retained);
    }


    private void enforceDepth(MindMapDto generated, Integer requestedMaxDepth) {
        int targetDepth = requestedMaxDepth == null ? 3 : requestedMaxDepth;
        targetDepth = Math.clamp(targetDepth, 2, 6);

        int nodeCount = generated.getNodes().size();
        if (nodeCount <= 1) {
            return;
        }

        generated.getNodes().getFirst().setParentId(null);

        for (int i = 1; i < nodeCount; i++) {
            val node = generated.getNodes().get(i);
            val rawParentId = node.getParentId();

            int parentIndex = rawParentId == null ? 0 : rawParentId.intValue();
            if (parentIndex < 0 || parentIndex >= i) {
                parentIndex = 0;
            }
            node.setParentId((long) parentIndex);

            int depth = computeDepth(generated.getNodes(), i, targetDepth);
            if (depth > targetDepth) {
                int safeParent = findAncestorWithinDepth(generated.getNodes(), parentIndex, targetDepth - 1);
                node.setParentId((long) safeParent);
            }
        }
    }

    private int computeDepth(List<NodeDto> nodes, int nodeIndex, int maxDepthGuard) {
        int depth = 1;
        int current = nodeIndex;
        int guard = 0;
        while (current > 0 && guard <= nodes.size()) {
            val parentId = nodes.get(current).getParentId();
            if (parentId == null) {
                break;
            }
            int parentIndex = parentId.intValue();
            if (parentIndex < 0 || parentIndex >= current) {
                return maxDepthGuard + 1;
            }
            depth++;
            current = parentIndex;
            if (depth > maxDepthGuard) {
                return depth;
            }
            guard++;
        }
        return depth;
    }

    private int findAncestorWithinDepth(List<NodeDto> nodes, int parentIndex, int maxAllowedDepth) {
        int current = parentIndex;
        int currentDepth = computeDepth(nodes, current, maxAllowedDepth + nodes.size());
        int guard = 0;
        while (currentDepth > maxAllowedDepth && current > 0 && guard <= nodes.size()) {
            val nextParent = nodes.get(current).getParentId();
            if (nextParent == null) {
                return 0;
            }
            int nextIndex = nextParent.intValue();
            if (nextIndex < 0 || nextIndex >= current) {
                return 0;
            }
            current = nextIndex;
            currentDepth = computeDepth(nodes, current, maxAllowedDepth + nodes.size());
            guard++;
        }
        return currentDepth <= maxAllowedDepth ? current : 0;
    }
    private boolean hasValidNode(NodeDto node) {
        return node != null && StringUtils.hasText(node.getText());
    }

    private NodeDto normalizeNodeDescription(NodeDto node) {
        val text = node.getText() == null ? "Nodo" : node.getText().trim();
        if (!StringUtils.hasText(node.getDescription())) {
            node.setDescription(String.format("Breve descrizione: %s.", text));
            return node;
        }
        val normalized = node.getDescription().trim().replaceAll("\\s+", " ");
        node.setDescription(normalized.length() > 280 ? normalized.substring(0, 280) : normalized);
        return node;
    }

}
