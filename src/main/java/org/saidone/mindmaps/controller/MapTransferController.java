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

import com.github.slugify.Slugify;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.service.MapTransferService;
import org.saidone.mindmaps.service.MindMapService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import static org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/maps")
public class MapTransferController {
    private final MapTransferService transfer;
    private final MindMapService maps;
    private static final Slugify SLUG = Slugify.builder().build();

    @GetMapping(value = "/{id}/export/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportMap(@PathVariable Long id) throws IOException {
        val map = maps.findMapWithNodes(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + SLUG.slugify(map.getTitle()) + ".json\"")
                .body(transfer.exportMap(id));
    }

    public record ImportedMap(Long id) {}

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ImportedMap importMap(HttpServletRequest request) throws IOException {
        if (request.getContentLengthLong() > MapTransferService.MAX_FILE_BYTES) throw tooLarge();
        val data = request.getInputStream().readNBytes(MapTransferService.MAX_FILE_BYTES + 1);
        if (data.length > MapTransferService.MAX_FILE_BYTES) throw tooLarge();
        return new ImportedMap(transfer.importMap(data));
    }

    private ResponseStatusException tooLarge() {
        return new ResponseStatusException(PAYLOAD_TOO_LARGE, "Il file della mappa supera il limite di 100 MB.");
    }
}
