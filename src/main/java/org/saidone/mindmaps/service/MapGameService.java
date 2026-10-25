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
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.dto.NodeDto;
import org.saidone.mindmaps.model.MindMap;
import org.saidone.mindmaps.repository.MindMapRepository;
import org.saidone.mindmaps.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.Clock;
import java.util.*;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class MapGameService {
    private final MindMapRepository repository;
    private final MindMapService maps;
    private final CurrentUserService users;
    private final Gson gson = new Gson();

    private MindMap owned(Long id) {
        return repository.findByIdAndOwnerUsernameIgnoreCase(id, users.getCurrentUser().getUsername())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    }

    public String publicToken(Long id) { return owned(id).getPublicToken(); }

    @Transactional
    public void publish(Long id) {
        val map = owned(id);
        val snapshot = maps.findMapWithNodes(id);
        if (snapshot.getNodes().stream().noneMatch(MapGameService::hasImage)) {
            throw new IllegalArgumentException("Aggiungi almeno un'immagine alla mappa prima di pubblicare il gioco.");
        }
        map.setPublishedSnapshot(gson.toJson(snapshot));
        map.setPublicToken(UUID.randomUUID().toString());
        repository.save(map);
    }

    @Transactional
    public void unpublish(Long id) {
        val map = owned(id);
        map.setPublicToken(null);
        map.setPublishedSnapshot(null);
        repository.save(map);
    }

    public MindMapDto published(String token) {
        val map = repository.findByPublicToken(token)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Gioco non disponibile"));
        if (map.getPublishedSnapshot() == null) throw new ResponseStatusException(NOT_FOUND);
        return gson.fromJson(map.getPublishedSnapshot(), MindMapDto.class);
    }

    public GameRun start(String token) { return new GameRun(token, published(token)); }

    private static boolean hasImage(NodeDto node) {
        return node.getImageUri() != null && !node.getImageUri().isBlank();
    }

    public record Card(String id, String uri) {}
    public record Board(String runId, MindMapDto map, List<Card> images) {}
    public record Result(boolean correct, String hint, int attempts, int errors, int matched,
                         int total, long seconds, int score, boolean complete) {}

    public static final class GameRun {
        public final String token;
        private final String id = UUID.randomUUID().toString();
        private final MindMapDto map;
        private final Map<String, NodeDto> answers = new HashMap<>();
        private final Set<Long> matched = new HashSet<>();
        private final Set<String> usedCards = new HashSet<>();
        private final Map<Long, String> originalImages = new HashMap<>();
        private final List<Card> cards = new ArrayList<>();
        private final Clock clock;
        private final Instant started;
        private Instant finished;
        private int attempts;
        private int errors;

        GameRun(String token, MindMapDto snapshot) {
            this(token, snapshot, Clock.systemUTC());
        }

        GameRun(String token, MindMapDto snapshot, Clock clock) {
            this.clock = clock;
            this.started = clock.instant();
            this.token = token;
            this.map = new Gson().fromJson(new Gson().toJson(snapshot), MindMapDto.class);
            for (val node : map.getNodes()) {
                if (!hasImage(node)) continue;
                val cardId = UUID.randomUUID().toString();
                originalImages.put(node.getId(), node.getImageUri());
                answers.put(cardId, snapshot.getNodes().stream().filter(n -> n.getId().equals(node.getId())).findFirst().orElseThrow());
                cards.add(new Card(cardId, node.getImageUri()));
                node.setImageUri("pending");
                node.setImageKeywords(null);
            }
            Collections.shuffle(cards);
        }

        public Board board() { return new Board(id, map, List.copyOf(cards)); }

        public synchronized Result attempt(String runId, String cardId, Long nodeId) {
            if (!id.equals(runId)) throw new ResponseStatusException(CONFLICT, "Partita sostituita: ricarica il gioco.");
            val answer = answers.get(cardId);
            val target = map.getNodes().stream().filter(n -> n.getId().equals(nodeId)).findFirst().orElse(null);
            if (answer == null || target == null || !hasImage(target)) throw new ResponseStatusException(BAD_REQUEST);
            if (finished != null || usedCards.contains(cardId) || matched.contains(nodeId)) {
                throw new ResponseStatusException(CONFLICT, "Immagine o casella già completata.");
            }
            attempts++;
            val correct = answer.getImageUri().equals(originalImages.get(nodeId));
            String hint = null;
            if (correct) {
                matched.add(nodeId);
                usedCards.add(cardId);
            }
            else {
                errors++;
                hint = answer.getDescription();
                if (hint == null || hint.isBlank() || hint.equals("Breve descrizione del nodo.")) {
                    hint = "Cerca la casella con il titolo: " + answer.getText();
                }
            }
            val complete = matched.size() == answers.size();
            if (complete) finished = clock.instant();
            val seconds = Math.max(0, java.time.Duration.between(started, finished == null ? clock.instant() : finished).getSeconds());
            // Give children time to learn: three free retries and at most 100 points lost.
            val retryPenalty = Math.min(100L, Math.max(0L, errors - 3L) * 5L);
            val score = (int) Math.max(0, Math.round(1000.0 * matched.size() / answers.size()) - retryPenalty);
            return new Result(correct, hint, attempts, errors, matched.size(), answers.size(), seconds, score, complete);
        }
    }
}
