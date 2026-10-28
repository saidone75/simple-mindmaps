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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.model.MapImage;
import org.saidone.mindmaps.repository.MapImageRepository;
import org.saidone.mindmaps.repository.MindMapRepository;
import org.saidone.mindmaps.repository.NodeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.ArrayList;

@Component
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "app.image-cleanup", name = "enabled", havingValue = "true", matchIfMissing = true)
public class OrphanMapImageCleanupScheduler {
    private final MapImageRepository images;
    private final NodeRepository nodes;
    private final MindMapRepository maps;
    private final MapImageFiles files;
    private final PlatformTransactionManager transactions;
    private final Gson json = new Gson();

    @Value("${app.image-cleanup.retention-days:7}")
    private int retentionDays;

    @Scheduled(cron = "${app.image-cleanup.cron:0 0 3 * * *}")
    public void cleanupOrphanImages() {
        try {
            val cutoff = Instant.now().minus(Math.max(1, retentionDays), ChronoUnit.DAYS);
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                val referenced = referencedImages();
                val orphaned = new ArrayList<MapImage>();
                for (val image : images.findAll()) {
                    if (referenced.contains(image.getId())) image.setOrphanedAt(null);
                    else if (image.getOrphanedAt() == null) image.setOrphanedAt(Instant.now());
                    else if (image.getOrphanedAt().isBefore(cutoff)) orphaned.add(image);
                }
                images.deleteAll(orphaned);
                images.flush();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        for (val image : orphaned) deleteUnreferencedFile(image);
                    }
                });
                log.info("Pulizia immagini: {} riferimenti, {} immagini orfane eliminate.", referenced.size(), orphaned.size());
            });
            cleanupUntrackedFiles(cutoff);
        } catch (Exception ex) {
            log.error("Pulizia immagini orfane non completata.", ex);
        }
    }

    private Set<String> referencedImages() {
        val referenced = new HashSet<String>();
        for (val node : nodes.findAll()) {
            addReference(referenced, node.getImageUri());
            if (node.getImageCandidates() != null) node.getImageCandidates().forEach(uri -> addReference(referenced, uri));
        }
        for (val map : maps.findAll()) {
            if (map.getPublishedSnapshot() == null) continue;
            // Parsing errors abort cleanup: an unreadable snapshot may still reference files.
            val snapshot = json.fromJson(map.getPublishedSnapshot(), MindMapDto.class);
            if (snapshot == null || snapshot.getNodes() == null) throw new IllegalStateException("Copia pubblicata non leggibile");
            for (val node : snapshot.getNodes()) {
                addReference(referenced, node.getImageUri());
                if (node.getImageCandidates() != null) node.getImageCandidates().forEach(uri -> addReference(referenced, uri));
            }
        }
        return referenced;
    }

    private void addReference(Set<String> referenced, String uri) {
        if (uri == null) return;
        String path = uri;
        if (uri.length() < 2048 && (uri.startsWith("https://") || uri.startsWith("http://"))) {
            try { path = URI.create(uri).getPath(); } catch (IllegalArgumentException ex) { return; }
        }
        if (path != null && path.matches("/images/[a-f0-9-]{36}")) referenced.add(path.substring("/images/".length()));
    }

    private void deleteUnreferencedFile(MapImage image) {
        if (image.getFilePath() == null || images.existsByFilePath(image.getFilePath())) return;
        try {
            Files.deleteIfExists(files.resolve(image.getFilePath()));
        } catch (Exception ex) {
            log.warn("File immagine non rimosso: {}", image.getId(), ex);
        }
    }

    private void cleanupUntrackedFiles(Instant cutoff) throws IOException {
        val directory = files.baseDirectory();
        if (!Files.isDirectory(directory)) return;
        try (val entries = Files.list(directory)) {
            for (val entry : entries.filter(Files::isRegularFile).toList()) {
                val name = entry.getFileName().toString();
                if (!name.matches("[a-f0-9-]{36}\\.(jpg|png|gif|webp|svg)")) continue;
                if (Files.getLastModifiedTime(entry).toInstant().isBefore(cutoff) && !images.existsByFilePath(name)) {
                    Files.deleteIfExists(entry);
                }
            }
        }
    }
}
