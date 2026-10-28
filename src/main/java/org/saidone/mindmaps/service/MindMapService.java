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

package org.saidone.mindmaps.service;

import com.google.gson.Gson;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.*;
import org.saidone.mindmaps.mapper.NodeMapper;
import org.saidone.mindmaps.model.MindMap;
import org.saidone.mindmaps.model.Node;
import org.saidone.mindmaps.repository.MindMapRepository;
import org.saidone.mindmaps.repository.NodeRepository;
import org.saidone.mindmaps.security.CurrentUserService;
import org.saidone.mindmaps.service.ai.GenerationProgress;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RequiredArgsConstructor
@Service
public class MindMapService {
    private static final int MIN_IMAGE_SIZE = 30;
    private static final int MAX_IMAGE_SIZE = 1000;
    private static final int MIN_NODE_WIDTH = 120;
    private static final int MAX_NODE_WIDTH = 1000;
    private static final int MIN_NODE_HEIGHT = 60;
    private static final int MAX_NODE_HEIGHT = 1000;
    private static final String DEFAULT_STYLE_PRESET = "CLASSIC";
    private static final String DEFAULT_SHAPE = "ROUNDED";
    private static final String DEFAULT_BRANCH_STYLE = "SOLID";
    private static final String DEFAULT_ROOT_NODE_COLOR = "var(--node-color-root)";
    private static final String DEFAULT_NODE_COLOR = "var(--node-color-default)";
    private static final String DEFAULT_BRANCH_COLOR = "var(--connector)";
    private static final String GREEN = "var(--node-color-template-green)";
    private static final String RED = "var(--node-color-template-red)";
    private static final String ORANGE = "var(--node-color-template-orange)";

    private final MindMapRepository mindMapRepository;
    private final NodeRepository nodeRepository;
    private final WikimediaImageSearchService wikimediaImageSearchService;
    private final CurrentUserService currentUserService;

    private final NodeMapper nodeMapper;
    private static final Gson PRIZES_JSON = new Gson();

    public List<MindMap> findAll() {
        return mindMapRepository.findByOwnerUsernameIgnoreCaseOrderByUpdatedAtDesc(currentUserService.getCurrentUser().getUsername());
    }

    public MindMapDto findMapWithNodes(Long id) {
        val map = getMap(id);
        val dto = new MindMapDto();
        dto.setId(map.getId());
        dto.setTitle(map.getTitle());
        dto.setPrizes(prizes(map));
        dto.setStylePreset(normalizeStylePreset(map.getStylePreset()));
        dto.setBackgroundColor(map.getBackgroundColor());
        dto.setNodes(nodeRepository.findByMapIdOrderByIdAsc(id).stream().map(nodeMapper::toDto).toList());
        return dto;
    }

    @Transactional
    public MindMap create(CreateMindMapRequest request) {
        val map = new MindMap();
        map.setTitle(request.getTitle().trim());
        map.setStylePreset(DEFAULT_STYLE_PRESET);
        map.setOwner(currentUserService.getCurrentUser());
        val savedMap = mindMapRepository.save(map);

        val root = new Node();
        root.setMapId(savedMap.getId());
        root.setParentId(null);
        root.setText(savedMap.getTitle());
        root.setDescription("Breve descrizione del tema principale.");
        root.setEmoji(null);
        root.setBranchText(null);
        root.setX(620);
        root.setY(260);
        root.setColor(DEFAULT_ROOT_NODE_COLOR);
        root.setFontSize(22);
        root.setShape(DEFAULT_SHAPE);
        root.setBranchColor(DEFAULT_BRANCH_COLOR);
        root.setBranchStyle(DEFAULT_BRANCH_STYLE);
        root.setImageUri(null);
        root.setImageWidth(null);
        root.setImageHeight(null);
        root.setNodeWidth(null);
        root.setNodeHeight(null);
        nodeRepository.save(root);

        return savedMap;
    }

    @Transactional
    public MindMap createFromTemplate(String templateKey) {
        val title = switch (templateKey) {
            case "italiano" -> "Italiano";
            case "scienze" -> "Scienze";
            case "storia" -> "Storia";
            case "geografia" -> "Geografia";
            default -> "Nuova mappa";
        };
        val map = new MindMap();
        map.setTitle(title);
        map.setStylePreset(DEFAULT_STYLE_PRESET);
        map.setOwner(currentUserService.getCurrentUser());
        val saved = mindMapRepository.save(map);

        val root = createNode(saved.getId(), null, title, "Breve descrizione del tema principale.", 620, 260, DEFAULT_ROOT_NODE_COLOR);

        switch (templateKey) {
            case "italiano" -> {
                createNode(saved.getId(), root.getId(), "Grammatica", "Regole e strutture della lingua.", 320, 120, DEFAULT_NODE_COLOR);
                createNode(saved.getId(), root.getId(), "Lettura", "Comprensione e analisi dei testi.", 930, 120, GREEN);
                createNode(saved.getId(), root.getId(), "Scrittura", "Produzione di testi chiari e coerenti.", 320, 420, RED);
                createNode(saved.getId(), root.getId(), "Lessico", "Arricchimento del vocabolario.", 930, 420, ORANGE);
            }
            case "scienze" -> {
                createNode(saved.getId(), root.getId(), "Animali", "Classificazione e caratteristiche principali.", 320, 120, DEFAULT_NODE_COLOR);
                createNode(saved.getId(), root.getId(), "Piante", "Strutture e funzioni essenziali.", 930, 120, GREEN);
                createNode(saved.getId(), root.getId(), "Corpo umano", "Sistemi e organi principali.", 320, 420, RED);
                createNode(saved.getId(), root.getId(), "Esperimenti", "Attività pratiche per osservare fenomeni.", 930, 420, ORANGE);
            }
            case "storia" -> {
                createNode(saved.getId(), root.getId(), "Linea del tempo", "Sequenza cronologica degli eventi.", 320, 120, DEFAULT_NODE_COLOR);
                createNode(saved.getId(), root.getId(), "Personaggi", "Figure storiche rilevanti.", 930, 120, GREEN);
                createNode(saved.getId(), root.getId(), "Eventi", "Fatti chiave da ricordare.", 320, 420, RED);
                createNode(saved.getId(), root.getId(), "Luoghi", "Aree geografiche coinvolte.", 930, 420, ORANGE);
            }
            default -> {
                createNode(saved.getId(), root.getId(), "Montagne", "Rilievi e caratteristiche.", 320, 120, DEFAULT_NODE_COLOR);
                createNode(saved.getId(), root.getId(), "Fiumi", "Corsi d'acqua principali.", 930, 120, GREEN);
                createNode(saved.getId(), root.getId(), "Clima", "Condizioni meteo tipiche.", 320, 420, RED);
                createNode(saved.getId(), root.getId(), "Città", "Centri urbani principali.", 930, 420, ORANGE);
            }
        }
        return saved;
    }

    @Transactional
    public MindMap createFromGeneratedMap(MindMapDto generatedMap, boolean searchWikimediaImages) {
        return createFromGeneratedMap(generatedMap, searchWikimediaImages, GenerationProgress.NONE);
    }

    @Transactional
    public MindMap createFromGeneratedMap(MindMapDto generatedMap, boolean searchWikimediaImages, GenerationProgress progress) {
        val totalNodes = generatedMap.getNodes().size();
        progress.update("Sto preparando i nodi della mappa…", 0, totalNodes);
        val title = generatedMap.getTitle() == null || generatedMap.getTitle().isBlank()
                ? "Mappa generata con AI"
                : generatedMap.getTitle().trim();

        val map = new MindMap();
        map.setTitle(title);
        map.setStylePreset(normalizeStylePreset(generatedMap.getStylePreset()));
        if (validPrizes(generatedMap.getPrizes())) {
            map.setPrizesJson(PRIZES_JSON.toJson(normalizePrizes(generatedMap.getPrizes())));
        }
        map.setOwner(currentUserService.getCurrentUser());
        val saved = mindMapRepository.save(map);

        val createdNodeIdsByIndex = new ArrayList<Long>();
        val usedImageUrls = new HashSet<String>();
        for (int index = 0; index < generatedMap.getNodes().size(); index++) {
            val nodeDto = generatedMap.getNodes().get(index);
            progress.update("Sto preparando il nodo \"%s\"…".formatted(nodeDto.getText()), index, totalNodes);

            Long parentId = null;
            val parentRef = nodeDto.getParentId();
            if (parentRef != null && parentRef >= 0 && parentRef < createdNodeIdsByIndex.size()) {
                parentId = createdNodeIdsByIndex.get(parentRef.intValue());
            }

            val node = createNode(
                    saved.getId(),
                    parentId,
                    nodeDto.getText().trim(),
                    normalizeNodeDescription(nodeDto.getDescription()),
                    nodeDto.getX() != null ? nodeDto.getX() : 620,
                    nodeDto.getY() != null ? nodeDto.getY() : 260,
                    nodeDto.getColor() != null ? nodeDto.getColor() : DEFAULT_NODE_COLOR
            );
            node.setTextColor(nodeDto.getTextColor());
            node.setHint(normalizeNodeHint(nodeDto.getHint()));
            node.setHint2(normalizeNodeHint(nodeDto.getHint2()));
            node.setHint3(normalizeNodeHint(nodeDto.getHint3()));
            node.setEmoji(normalizeNodeEmoji(nodeDto.getEmoji()));
            node.setBranchText(normalizeBranchText(nodeDto.getBranchText()));
            if (searchWikimediaImages) {
                progress.update("Sto cercando un’immagine per il nodo \"%s\"…".formatted(nodeDto.getText()), index, totalNodes);
                val imageUri = normalizeImageUri(wikimediaImageSearchService.searchImage(
                        normalizeImageKeywords(nodeDto), null, usedImageUrls));
                node.setImageUri(imageUri != null && usedImageUrls.add(imageUri) ? imageUri : null);
            } else {
                node.setImageUri(normalizeImageUri(nodeDto.getImageUri()));
            }
            nodeRepository.save(node);

            createdNodeIdsByIndex.add(node.getId());
        }

        progress.update("Sto salvando la mappa…", totalNodes, totalNodes);
        return saved;
    }

    @Transactional
    public NodeDto addNode(Long mapId, CreateNodeRequest request) {
        getMap(mapId);
        validateParentBelongsToMap(mapId, request.getParentId());
        val node = new Node();
        node.setMapId(mapId);
        node.setParentId(request.getParentId());
        node.setText(request.getText() == null || request.getText().isBlank() ? "Nuovo nodo" : request.getText().trim());
        node.setDescription(normalizeNodeDescription(request.getDescription()));
        node.setHint(normalizeNodeHint(request.getHint()));
        node.setHint2(normalizeNodeHint(request.getHint2()));
        node.setHint3(normalizeNodeHint(request.getHint3()));
        node.setEmoji(normalizeNodeEmoji(request.getEmoji()));
        node.setBranchText(normalizeBranchText(request.getBranchText()));
        node.setX(request.getX() == null ? 300 : request.getX());
        node.setY(request.getY() == null ? 200 : request.getY());
        node.setColor(request.getColor() == null ? DEFAULT_NODE_COLOR : request.getColor());
        node.setTextColor(request.getTextColor());
        node.setFontSize(request.getFontSize() == null ? 18 : request.getFontSize());
        node.setShape(request.getShape() == null ? DEFAULT_SHAPE : request.getShape());
        node.setBranchColor(request.getBranchColor() == null ? DEFAULT_BRANCH_COLOR : request.getBranchColor());
        node.setBranchStyle(request.getBranchStyle() == null ? DEFAULT_BRANCH_STYLE : request.getBranchStyle());
        node.setImageUri(normalizeImageUri(request.getImageUri()));
        node.setImageWidth(normalizeImageSize(request.getImageWidth()));
        node.setImageHeight(normalizeImageSize(request.getImageHeight()));
        node.setNodeWidth(normalizeNodeWidth(request.getNodeWidth()));
        node.setNodeHeight(normalizeNodeHeight(request.getNodeHeight()));
        return nodeMapper.toDto(nodeRepository.save(node));
    }

    @Transactional
    public NodeDto updateNode(Long nodeId, UpdateNodeRequest request) {
        val node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Nodo non trovato"));
        getMap(node.getMapId());
        applyNodeUpdate(node, request);

        return nodeMapper.toDto(nodeRepository.save(node));
    }

    private void validateParentBelongsToMap(Long mapId, Long parentId) {
        if (parentId == null) {
            return;
        }
        val parent = nodeRepository.findById(parentId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Nodo padre non trovato"));
        if (!mapId.equals(parent.getMapId())) {
            throw new ResponseStatusException(NOT_FOUND, "Nodo padre non trovato");
        }
    }

    private void applyNodeUpdate(Node node, UpdateNodeRequest request) {
        updateIfPresent(request.getText(), value -> node.setText(normalizeNodeText(value)));
        updateIfPresent(request.getDescription(), value -> node.setDescription(normalizeNodeDescription(value)));
        updateIfPresent(request.getHint(), value -> node.setHint(normalizeNodeHint(value)));
        updateIfPresent(request.getHint2(), value -> node.setHint2(normalizeNodeHint(value)));
        updateIfPresent(request.getHint3(), value -> node.setHint3(normalizeNodeHint(value)));
        updateIfPresent(request.getEmoji(), value -> node.setEmoji(normalizeNodeEmoji(value)));
        updateIfPresent(request.getBranchText(), value -> node.setBranchText(normalizeBranchText(value)));
        updateIfPresent(request.getX(), node::setX);
        updateIfPresent(request.getY(), node::setY);
        updateIfPresent(request.getColor(), node::setColor);
        updateIfPresent(request.getTextColor(), node::setTextColor);
        updateIfPresent(request.getFontSize(), node::setFontSize);
        updateIfPresent(request.getShape(), node::setShape);
        updateIfPresent(request.getBranchColor(), node::setBranchColor);
        updateIfPresent(request.getBranchStyle(), node::setBranchStyle);
        node.setImageUri(normalizeImageUri(request.getImageUri()));
        node.setImageWidth(normalizeImageSize(request.getImageWidth()));
        node.setImageHeight(normalizeImageSize(request.getImageHeight()));
        updateIfPresent(request.getNodeWidth(), value -> node.setNodeWidth(normalizeNodeWidth(value)));
        updateIfPresent(request.getNodeHeight(), value -> node.setNodeHeight(normalizeNodeHeight(value)));
    }

    private <T> void updateIfPresent(T value, Consumer<T> updater) {
        if (value != null) {
            updater.accept(value);
        }
    }

    private String normalizeNodeText(String text) {
        val normalized = text.trim();
        return normalized.isEmpty() ? "Nodo" : normalized;
    }

    @Transactional
    public void deleteNode(Long nodeId) {
        val node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Nodo non trovato"));
        getMap(node.getMapId());

        val mapNodes = nodeRepository.findByMapIdOrderByIdAsc(node.getMapId());
        deleteRecursive(nodeId, mapNodes);
    }

    @Transactional
    public MindMap cloneMap(Long mapId) {
        val sourceMap = getMap(mapId);
        val sourceNodes = nodeRepository.findByMapIdOrderByIdAsc(mapId);

        val clonedMap = new MindMap();
        clonedMap.setTitle(sourceMap.getTitle() + " (Copia)");
        clonedMap.setPrizesJson(sourceMap.getPrizesJson());
        clonedMap.setStylePreset(normalizeStylePreset(sourceMap.getStylePreset()));
        clonedMap.setBackgroundColor(sourceMap.getBackgroundColor());
        clonedMap.setOwner(sourceMap.getOwner());
        val savedMap = mindMapRepository.save(clonedMap);
        val clonedBySourceId = new ConcurrentHashMap<Long, Node>();

        val gson = new Gson();

        sourceNodes.forEach(
                sourceNode -> {
                    val clonedNode = gson.fromJson(gson.toJson(sourceNode), Node.class);
                    clonedNode.setId(null);
                    clonedNode.setMapId(savedMap.getId());
                    clonedNode.setParentId(null);
                    val savedNode = nodeRepository.save(clonedNode);
                    clonedBySourceId.put(sourceNode.getId(), savedNode);
                }
        );

        sourceNodes.forEach(
                sourceNode -> {
                    if (sourceNode.getParentId() != null) {
                        val clonedNode = clonedBySourceId.get(sourceNode.getId());
                        val clonedParent = clonedBySourceId.get(sourceNode.getParentId());
                        clonedNode.setParentId(clonedParent == null ? null : clonedParent.getId());
                        nodeRepository.save(clonedNode);
                    }
                }
        );

        return savedMap;
    }

    @Transactional
    public void deleteMap(Long id) {
        getMap(id);
        nodeRepository.deleteByMapId(id);
        mindMapRepository.deleteById(id);
    }

    public record RestoredMap(MindMapDto map, Map<Long, Long> nodeIds) {}

    @Transactional
    public RestoredMap restoreMap(Long mapId, MindMapDto snapshot) {
        val map = getMap(mapId);
        val invalid = new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stato della mappa non valido");
        if (snapshot == null || snapshot.getNodes() == null || snapshot.getNodes().isEmpty()
                || snapshot.getTitle() == null || snapshot.getTitle().isBlank()) throw invalid;
        val sources = new LinkedHashMap<Long, NodeDto>();
        for (val source : snapshot.getNodes()) {
            if (source == null || source.getId() == null || sources.putIfAbsent(source.getId(), source) != null
                    || source.getText() == null || source.getX() == null || source.getY() == null
                    || source.getColor() == null || source.getFontSize() == null || source.getShape() == null
                    || source.getBranchColor() == null || source.getBranchStyle() == null) throw invalid;
        }
        for (val source : sources.values()) {
            val visited = new HashSet<Long>();
            NodeDto current = source;
            while (current != null) {
                if (!visited.add(current.getId())) throw invalid;
                val parent = current.getParentId();
                if (parent != null && !sources.containsKey(parent)) throw invalid;
                current = parent == null ? null : sources.get(parent);
            }
        }
        if (snapshot.getBackgroundColor() != null && !snapshot.getBackgroundColor().matches("#[0-9a-fA-F]{6}")) throw invalid;
        val existing = nodeRepository.findByMapIdOrderByIdAsc(mapId);
        val byId = new HashMap<Long, Node>();
        existing.forEach(node -> byId.put(node.getId(), node));
        val restored = new LinkedHashMap<Long, Node>();
        val ids = new LinkedHashMap<Long, Long>();
        for (val source : sources.values()) {
            // Only reuse IDs belonging to this map; deleted nodes receive fresh IDs.
            val node = byId.getOrDefault(source.getId(), new Node());
            nodeMapper.restore(source, node);
            node.setMapId(mapId);
            node.setParentId(null);
            nodeRepository.save(node);
            restored.put(source.getId(), node);
            ids.put(source.getId(), node.getId());
        }
        for (val source : sources.values()) {
            restored.get(source.getId()).setParentId(ids.get(source.getParentId()));
        }
        nodeRepository.deleteAll(existing.stream().filter(node -> !sources.containsKey(node.getId())).toList());
        map.setTitle(snapshot.getTitle());
        map.setStylePreset(normalizeStylePreset(snapshot.getStylePreset()));
        map.setBackgroundColor(snapshot.getBackgroundColor());
        if (validPrizes(snapshot.getPrizes())) map.setPrizesJson(PRIZES_JSON.toJson(normalizePrizes(snapshot.getPrizes())));
        mindMapRepository.save(map);
        nodeRepository.flush();
        return new RestoredMap(findMapWithNodes(mapId), ids);
    }

    @Transactional
    public MindMapDto updateMapStyle(Long mapId, String stylePreset) {
        val map = getMap(mapId);
        map.setStylePreset(normalizeStylePreset(stylePreset));
        mindMapRepository.save(map);
        return findMapWithNodes(mapId);
    }

    @Transactional
    public MindMapDto updateMapBackground(Long mapId, String backgroundColor) {
        val map = getMap(mapId);
        if (backgroundColor == null || !backgroundColor.matches("#[0-9a-fA-F]{6}")) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Colore di sfondo non valido");
        }
        map.setBackgroundColor(backgroundColor);
        mindMapRepository.save(map);
        return findMapWithNodes(mapId);
    }

    @Transactional
    public MindMapDto updateMapTitle(Long mapId, String title) {
        val map = getMap(mapId);
        val normalizedTitle = title == null || title.trim().isBlank() ? "Nuova mappa" : title.trim();
        map.setTitle(normalizedTitle);
        mindMapRepository.save(map);
        return findMapWithNodes(mapId);
    }

    @Transactional
    public void updatePrizes(Long mapId, List<String> prizes) {
        val map = getMap(mapId);
        map.setPrizesJson(PRIZES_JSON.toJson(normalizePrizes(prizes)));
        mindMapRepository.save(map);
    }

    private List<String> prizes(MindMap map) {
        if (map.getPrizesJson() == null) return defaultPrizes(map.getTitle());
        val prizes = Arrays.asList(PRIZES_JSON.fromJson(map.getPrizesJson(), String[].class));
        return validPrizes(prizes) ? normalizePrizes(prizes) : defaultPrizes(map.getTitle());
    }

    private static boolean validPrizes(List<String> prizes) {
        return prizes != null && prizes.size() == 5
                && prizes.stream().allMatch(prize -> prize != null && !prize.isBlank() && prize.strip().length() <= 120)
                && prizes.stream().map(prize -> prize.strip().toLowerCase(Locale.ROOT)).distinct().count() == 5;
    }

    private static List<String> normalizePrizes(List<String> prizes) {
        if (!validPrizes(prizes)) {
            throw new IllegalArgumentException("Inserisci cinque titoli premio diversi, da 1 a 120 caratteri ciascuno.");
        }
        return prizes.stream().map(String::strip).toList();
    }

    private static List<String> defaultPrizes(String topic) {
        val theme = topic == null || topic.isBlank() ? "questa avventura" : topic.strip();
        val shortTheme = theme.substring(0, Math.min(65, theme.length()));
        return List.of(
                String.format("Una scintilla di idee: %s", shortTheme),
                String.format("Detective delle sorprese: %s", shortTheme),
                String.format("Acchiappastelle in missione: %s", shortTheme),
                String.format("Regista di nuove scoperte: %s", shortTheme),
                String.format("Un fuoco d’artificio di scoperte: %s", shortTheme));
    }

    private void deleteRecursive(Long nodeId, List<Node> allNodes) {
        for (val child : allNodes.stream().filter(n -> nodeId.equals(n.getParentId())).toList()) {
            deleteRecursive(child.getId(), allNodes);
        }
        nodeRepository.deleteById(nodeId);
    }

    private Node createNode(Long mapId, Long parentId, String text, String description, int x, int y, String color) {
        val node = new Node();
        node.setMapId(mapId);
        node.setParentId(parentId);
        node.setText(text);
        node.setDescription(normalizeNodeDescription(description));
        node.setEmoji(null);
        node.setBranchText(null);
        node.setX(x);
        node.setY(y);
        node.setColor(color);
        node.setFontSize(parentId == null ? 22 : 18);
        node.setShape(DEFAULT_SHAPE);
        node.setBranchColor(DEFAULT_BRANCH_COLOR);
        node.setBranchStyle(DEFAULT_BRANCH_STYLE);
        node.setImageUri(null);
        node.setImageWidth(null);
        node.setImageHeight(null);
        node.setNodeWidth(null);
        node.setNodeHeight(null);
        return nodeRepository.save(node);
    }

    private String[] normalizeImageKeywords(NodeDto nodeDto) {
        if (nodeDto == null) return new String[0];
        if (nodeDto.getImageKeywords() != null && nodeDto.getImageKeywords().length > 0) {
            return java.util.Arrays.stream(nodeDto.getImageKeywords())
                    .filter(java.util.Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .limit(4)
                    .toArray(String[]::new);
        }
        val text = nodeDto.getText() == null ? "" : nodeDto.getText().trim();
        return text.isEmpty() ? new String[0] : text.split("\\s+");
    }

    private MindMap getMap(Long id) {
        return mindMapRepository.findByIdAndOwnerUsernameIgnoreCase(id, currentUserService.getCurrentUser().getUsername())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Mappa non trovata"));
    }


    private String normalizeImageUri(String imageUri) {
        if (imageUri == null) return null;
        val value = imageUri.trim();
        return value.isEmpty() ? null : value;
    }

    private Integer normalizeImageSize(Integer imageSize) {
        if (imageSize == null) return null;
        return Math.clamp(imageSize, MIN_IMAGE_SIZE, MAX_IMAGE_SIZE);
    }

    private Integer normalizeNodeWidth(Integer nodeWidth) {
        if (nodeWidth == null) return null;
        return Math.clamp(nodeWidth, MIN_NODE_WIDTH, MAX_NODE_WIDTH);
    }

    private Integer normalizeNodeHeight(Integer nodeHeight) {
        if (nodeHeight == null) return null;
        return Math.clamp(nodeHeight, MIN_NODE_HEIGHT, MAX_NODE_HEIGHT);
    }

    private String normalizeNodeEmoji(String emoji) {
        if (emoji == null) return null;
        val value = emoji.trim();
        if (value.isEmpty()) return null;
        return value.codePoints()
                .limit(2)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                .toString();
    }

    private String normalizeNodeHint(String hint) {
        if (hint == null || hint.isBlank()) return null;
        val normalized = hint.trim().replaceAll("\\s+", " ");
        return normalized.length() > 280 ? normalized.substring(0, 280) : normalized;
    }

    private String normalizeNodeDescription(String description) {
        if (description == null || description.isBlank()) return "Breve descrizione del nodo.";
        val normalized = description.trim().replaceAll("\\s+", " ");
        return normalized.length() > 280 ? normalized.substring(0, 280) : normalized;
    }

    private String normalizeBranchText(String branchText) {
        if (branchText == null) return null;
        val value = branchText.trim();
        if (value.isEmpty()) return null;
        return value.length() > 120 ? value.substring(0, 120) : value;
    }

    private String normalizeStylePreset(String stylePreset) {
        if (stylePreset == null || stylePreset.isBlank()) return DEFAULT_STYLE_PRESET;
        return switch (stylePreset.trim().toUpperCase()) {
            case "PLAYFUL", "OCEAN", "CANDY", DEFAULT_STYLE_PRESET -> stylePreset.trim().toUpperCase();
            default -> DEFAULT_STYLE_PRESET;
        };
    }

}
