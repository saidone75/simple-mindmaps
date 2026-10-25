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

package org.saidone.mindmaps.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.service.MapGameService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;

@Controller
@RequiredArgsConstructor
@RequestMapping("/play/{token}")
public class MapGameController {
    private final MapGameService games;
    private static final String RUN = MapGameController.class.getName();

    @GetMapping
    public String page(@PathVariable String token, Model model, HttpServletResponse response) {
        try {
            model.addAttribute("title", games.published(token).getTitle());
        } catch (ResponseStatusException ex) {
            response.setStatus(ex.getStatusCode().value());
            model.addAttribute("title", "Gioco non disponibile");
            model.addAttribute("unavailable", true);
        }
        return "maps/game";
    }

    @ExceptionHandler(ResponseStatusException.class)
    @ResponseBody
    public ResponseEntity<Map<String, String>> gameError(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).cacheControl(CacheControl.noStore())
                .body(Map.of("message", ex.getReason() == null ? "Operazione non disponibile" : ex.getReason()));
    }

    @PostMapping("/start")
    @ResponseBody
    public ResponseEntity<MapGameService.Board> start(@PathVariable String token, HttpSession session) {
        val run = games.start(token);
        session.setAttribute(RUN, run);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(run.board());
    }

    public record Attempt(String runId, String imageId, Long nodeId) {}

    @PostMapping("/attempt")
    @ResponseBody
    public ResponseEntity<MapGameService.Result> attempt(@PathVariable String token, @RequestBody Attempt attempt, HttpSession session) {
        games.published(token); // Recheck publication so withdrawn links stop active games too.
        val run = (MapGameService.GameRun) session.getAttribute(RUN);
        if (run == null || !run.token.equals(token)) throw new ResponseStatusException(CONFLICT, "Avvia una nuova partita.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(run.attempt(attempt.runId(), attempt.imageId(), attempt.nodeId()));
    }
}
