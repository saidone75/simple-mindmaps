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
import lombok.extern.slf4j.Slf4j;
import org.saidone.mindmaps.service.MapTransferService;
import org.saidone.mindmaps.service.MindMapService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import static org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE;

@RestController
@Slf4j
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
                .header(HttpHeaders.CONTENT_DISPOSITION, String.format("attachment; filename=\"%s.json\"", SLUG.slugify(map.getTitle())))
                .body(transfer.exportMap(id));
    }

    @GetMapping(value = "/{id}/export/zip", produces = "application/zip")
    public ResponseEntity<byte[]> exportZip(@PathVariable Long id) throws IOException {
        val map = maps.findMapWithNodes(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, String.format("attachment; filename=\"%s.zip\"", SLUG.slugify(map.getTitle())))
                .body(transfer.exportZip(id));
    }

    public record ImportedMap(Long id) {}

    @PostMapping(value = "/import", consumes = {MediaType.APPLICATION_JSON_VALUE, "application/zip", MediaType.APPLICATION_OCTET_STREAM_VALUE})
    public ImportedMap importMap(HttpServletRequest request) throws IOException {
        if (request.getContentLengthLong() > MapTransferService.MAX_FILE_BYTES) throw tooLarge();
        val data = request.getInputStream().readNBytes(MapTransferService.MAX_FILE_BYTES + 1);
        if (data.length > MapTransferService.MAX_FILE_BYTES) throw tooLarge();
        val id = transfer.importMap(data);
        log.info("Mappa importata: id={}, file di {} byte.", id, data.length);
        return new ImportedMap(id);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> transferError(Exception exception, HttpServletRequest request) {
        val status = exception instanceof ErrorResponse error ? error.getStatusCode() : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status.is5xxServerError()) {
            log.error("Errore nel trasferimento di una mappa: {} {} (HTTP {}).",
                    request.getMethod(), request.getRequestURI(), status.value(), exception);
            return ResponseEntity.status(status).body(ProblemDetail.forStatusAndDetail(status,
                    "Non riesco a completare il trasferimento della mappa. La causa è stata registrata nei log del server."));
        }
        val problem = ((ErrorResponse) exception).getBody();
        log.warn("Trasferimento mappa rifiutato: {} {} (HTTP {}): {}",
                request.getMethod(), request.getRequestURI(), status.value(), problem.getDetail());
        return ResponseEntity.status(status).body(problem);
    }

    private ResponseStatusException tooLarge() {
        return new ResponseStatusException(PAYLOAD_TOO_LARGE, "Il file della mappa supera il limite di 100 MB.");
    }
}
