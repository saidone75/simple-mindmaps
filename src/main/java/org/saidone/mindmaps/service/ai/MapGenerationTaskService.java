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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmaps.dto.MapGenerationRequestDto;
import org.saidone.mindmaps.service.MindMapService;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.concurrent.DelegatingSecurityContextRunnable;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MapGenerationTaskService {
    private final MapGenerationApplicationService generation;
    private final MindMapService maps;
    private final ThreadPoolTaskExecutor executor = createExecutor();
    private final Cache<UUID, Task> tasks = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    public enum Status { QUEUED, RUNNING, COMPLETED, FAILED }

    public record Progress(UUID id, Status status, String activity, int completedNodes, int totalNodes, Long mapId) {}

    public Progress start(MapGenerationRequestDto request, String owner) {
        if (request.getTopic() == null || request.getTopic().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Inserisci un argomento per la mappa.");
        }
        val task = new Task(owner);
        tasks.put(task.id, task);
        try {
            // Keep the authenticated owner available to the existing map services.
            executor.execute(new DelegatingSecurityContextRunnable(() -> generate(task, request)));
        } catch (TaskRejectedException ex) {
            tasks.invalidate(task.id);
            throw new ResponseStatusException(TOO_MANY_REQUESTS, "Ci sono già molte mappe in preparazione. Riprova tra poco.");
        }
        return task.progress.get();
    }

    public Progress get(UUID id, String owner) {
        val task = tasks.getIfPresent(id);
        if (task == null || !task.owner.equalsIgnoreCase(owner)) {
            throw new ResponseStatusException(NOT_FOUND, "Attività non trovata o scaduta.");
        }
        return task.progress.get();
    }

    private void generate(Task task, MapGenerationRequestDto request) {
        log.info("Avvio creazione mappa in background | task={}", task.id);
        try {
            val generated = generation.generateMindMap(request, task::update);
            val map = maps.createFromGeneratedMap(generated, Boolean.TRUE.equals(request.getIncludeWikimediaImages()), task::update);
            val total = generated.getNodes().size();
            task.progress.set(new Progress(task.id, Status.COMPLETED, "La mappa è pronta! Sto aprendo l’editor…", total, total, map.getId()));
            log.info("Mappa creata | task={} | mapId={}", task.id, map.getId());
        } catch (RuntimeException ex) {
            task.progress.updateAndGet(previous -> new Progress(task.id, Status.FAILED,
                    "Non sono riuscito a completare la mappa. Riprova tra poco.", previous.completedNodes(), previous.totalNodes(), null));
            log.error("Creazione mappa non riuscita | task={}", task.id, ex);
        }
    }

    private static ThreadPoolTaskExecutor createExecutor() {
        val executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(8);
        executor.setThreadNamePrefix("map-generation-");
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdown();
    }

    private static final class Task {
        private final UUID id = UUID.randomUUID();
        private final String owner;
        private final AtomicReference<Progress> progress;

        private Task(String owner) {
            this.owner = owner;
            this.progress = new AtomicReference<>(new Progress(id, Status.QUEUED, "La richiesta è in attesa. Inizierò appena possibile…", 0, 0, null));
        }

        private void update(String activity, int completedNodes, int totalNodes) {
            progress.set(new Progress(id, Status.RUNNING, activity, completedNodes, totalNodes, null));
        }
    }
}
