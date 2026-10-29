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
import org.saidone.mindmaps.model.AppUser;
import org.saidone.mindmaps.repository.MindMapRepository;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.saidone.mindmaps.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Stream;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class MapGameService {
    private final MindMapRepository repository;
    private final MindMapService maps;
    private final CurrentUserService users;
    private final AppUserRepository accounts;
    private final Gson gson = new Gson();

    private MindMap owned(Long id) {
        return repository.findByIdAndOwnerUsernameIgnoreCase(id, users.getCurrentUser().getUsername())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    }

    public String publicToken(Long id) { return owned(id).getPublicToken(); }

    public record TeacherPage(Long id, String username) {}

    private TeacherPage publicTeacherPage(AppUser teacher) {
        return new TeacherPage(teacher.getId(), teacher.getUsername());
    }

    public TeacherPage currentTeacherPage() { return publicTeacherPage(users.getCurrentUser()); }

    public TeacherPage teacherPage(Long id) {
        val teacher = accounts.findById(id).filter(account -> account.isEnabled())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Pagina dei giochi non disponibile"));
        return publicTeacherPage(teacher);
    }

    public TeacherPage teacherPage(String username) {
        val teacher = accounts.findByUsernameIgnoreCase(username).filter(account -> account.isEnabled())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Pagina dei giochi non disponibile"));
        return publicTeacherPage(teacher);
    }

    public TeacherPage teacherPageForGame(String token) {
        val map = repository.findByPublicToken(token)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Gioco non disponibile"));
        return map.getOwner() == null ? null : teacherPage(map.getOwner().getId());
    }

    public record PublishedGame(String token, String title, String imageUri) {}

    public List<PublishedGame> teacherGames(Long teacherId) {
        teacherPage(teacherId);
        return repository.findByOwnerIdAndPublicTokenIsNotNullAndPublishedSnapshotIsNotNullOrderByUpdatedAtDesc(teacherId)
                .stream()
                .map(map -> {
                    val snapshot = gson.fromJson(map.getPublishedSnapshot(), MindMapDto.class);
                    val image = snapshot.getNodes() == null ? null : snapshot.getNodes().stream()
                            .filter(Objects::nonNull)
                            .filter(node -> node.getParentId() == null)
                            .findFirst().filter(MapGameService::hasImage)
                            .map(node -> node.getImageUri().trim()).orElse(null);
                    return new PublishedGame(map.getPublicToken(), snapshot.getTitle(), image);
                })
                .toList();
    }

    @Transactional
    public void publish(Long id) {
        val map = owned(id);
        val snapshot = maps.findMapWithNodes(id);
        if (snapshot.getNodes().stream().noneMatch(MapGameService::hasImage)) {
            throw new IllegalArgumentException("Aggiungi almeno un'immagine alla mappa prima di pubblicare il gioco.");
        }
        snapshot.getNodes().forEach(node -> node.setImageCandidates(null));
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

    public record Card(String id, String uri, Integer imageWidth, Integer imageHeight,
                       Integer imageZoom, Integer imagePositionX, Integer imagePositionY) implements Serializable {}
    public record Board(String runId, MindMapDto map, List<Card> images) {}
    public record Result(boolean correct, String hint, int attempts, int errors, int matched,
                         int total, long seconds, int level, String prize, boolean complete) {}

    public static final class GameRun implements Serializable {
        @Serial
        private static final long serialVersionUID = 1L;

        public final String token;
        private final String id = UUID.randomUUID().toString();
        private final MindMapDto map;
        private final Map<String, NodeDto> answers = new HashMap<>();
        private final Set<Long> matched = new HashSet<>();
        private final Set<String> usedCards = new HashSet<>();
        private final Map<Long, String> originalImages = new HashMap<>();
        private final List<Card> cards = new ArrayList<>();
        private transient Clock clock;
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
                node.setHint(null);
                node.setHint2(null);
                node.setHint3(null);
                node.setImageCandidates(null);
                if (!hasImage(node)) continue;
                val cardId = UUID.randomUUID().toString();
                originalImages.put(node.getId(), node.getImageUri());
                answers.put(cardId, snapshot.getNodes().stream().filter(n -> n.getId().equals(node.getId())).findFirst().orElseThrow());
                cards.add(new Card(cardId, node.getImageUri(), node.getImageWidth(), node.getImageHeight(),
                        node.getImageZoom(), node.getImagePositionX(), node.getImagePositionY()));
                node.setImageUri("pending");
                node.setImageKeywords(null);
            }
            Collections.shuffle(cards);
        }

        @Serial
        private void readObject(ObjectInputStream input) throws IOException, ClassNotFoundException {
            input.defaultReadObject();
            clock = Clock.systemUTC();
        }

        public Board board() { return new Board(id, map, List.copyOf(cards)); }

        private String randomHint(NodeDto node) {
            val hints = Stream.of(node.getHint(), node.getHint2(), node.getHint3())
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .distinct()
                    .toList();
            return hints.isEmpty()
                    ? "Osserva i dettagli dell’immagine e prova un’altra casella. Puoi farcela!"
                    : hints.get(ThreadLocalRandom.current().nextInt(hints.size()));
        }

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
                hint = randomHint(answer);
            }
            val complete = matched.size() == answers.size();
            if (complete) finished = clock.instant();
            val seconds = Math.max(0, java.time.Duration.between(started, finished == null ? clock.instant() : finished).getSeconds());
            // Levels reward progress only: retries and time never remove an achievement.
            val total = answers.size();
            val level = 1 + matched.size() * 4 / Math.max(1, total);
            val prizes = map.getPrizes();
            val prize = prizes != null && prizes.size() == 5 && prizes.get(level - 1) != null
                    ? prizes.get(level - 1) : "Esploratore delle meraviglie";
            return new Result(correct, hint, attempts, errors, matched.size(), total, seconds, level, prize, complete);
        }
    }
}
