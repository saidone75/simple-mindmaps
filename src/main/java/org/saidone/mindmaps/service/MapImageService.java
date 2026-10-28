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

import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.NodeDto;
import org.saidone.mindmaps.mapper.NodeMapper;
import org.saidone.mindmaps.model.MapImage;
import org.saidone.mindmaps.model.Node;
import org.saidone.mindmaps.repository.MapImageRepository;
import org.saidone.mindmaps.repository.MindMapRepository;
import org.saidone.mindmaps.repository.NodeRepository;
import org.saidone.mindmaps.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import java.util.Objects;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class MapImageService {
    private final MapImageRepository images;
    private final NodeRepository nodes;
    private final MindMapRepository maps;
    private final CurrentUserService users;
    private final NodeMapper mapper;
    private final ImageDownloadService downloads;
    private final MapImageNormalizer normalizer;
    private final MapImageFiles files;
    private final PlatformTransactionManager transactions;

    private Node ownedNode(Long id, String username) {
        val node = nodes.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        maps.findByIdAndOwnerUsernameIgnoreCase(node.getMapId(), username)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        return node;
    }

    public NodeDto store(Long nodeId, String expectedSource) {
        val owner = users.getCurrentUser();
        val current = ownedNode(nodeId, owner.getUsername());
        val source = current.getImageUri();
        if (!Objects.equals(source, expectedSource)) {
            throw new ResponseStatusException(CONFLICT, "L’immagine del nodo è cambiata. Ricarica la mappa e riprova.");
        }
        if (source != null && source.matches("/images/[a-f0-9-]{36}")) return mapper.toDto(current);
        if (source == null || !(source.startsWith("https://") || source.startsWith("http://"))) {
            throw new ResponseStatusException(BAD_REQUEST, "Scegli prima un’immagine con un link HTTP o HTTPS.");
        }
        // Network access happens before opening the SQLite write transaction.
        val downloaded = normalizer.normalize(downloads.download(source));
        val image = new MapImage();
        image.setId(UUID.randomUUID().toString());
        image.setOwnerId(owner.getId());
        image.setMediaType(downloaded.mediaType());
        image.setFilePath(files.write(image.getId(), downloaded.data(), downloaded.mediaType()));
        return new TransactionTemplate(transactions).execute(status -> {
            val node = ownedNode(nodeId, owner.getUsername());
            if (!source.equals(node.getImageUri())) {
                throw new ResponseStatusException(CONFLICT, "L’immagine del nodo è cambiata. Ricarica la mappa e riprova.");
            }
            images.save(image);
            val reference = "/images/" + image.getId();
            node.setImageUri(reference);
            // Use the same reference in alternatives, preserving duplicate detection.
            for (val other : nodes.findByMapIdOrderByIdAsc(node.getMapId())) {
                if (other.getImageCandidates() != null && other.getImageCandidates().contains(source)) {
                    other.setImageCandidates(other.getImageCandidates().stream()
                            .map(candidate -> source.equals(candidate) ? reference : candidate).toList());
                }
            }
            nodes.save(node);
            return mapper.toDto(node);
        });
    }

    public MapImage get(UUID id) {
        return images.findById(id.toString()).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    }
}
