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

import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.NodeDto;
import org.saidone.mindmaps.service.MapImageService;
import org.saidone.mindmaps.service.MapImageFiles;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import java.time.Duration;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class MapImageController {
    private final MapImageService images;
    private final MapImageFiles files;

    public record StoreImageRequest(String imageUri) {}

    @PostMapping("/api/nodes/{nodeId}/image")
    public NodeDto store(@PathVariable Long nodeId, @RequestBody StoreImageRequest request) {
        return images.store(nodeId, request.imageUri());
    }

    @GetMapping("/images/{id}")
    public ResponseEntity<Resource> image(@PathVariable UUID id) {
        val image = images.get(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.getMediaType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic())
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .header("X-Content-Type-Options", "nosniff")
                .body(files.load(image.getFilePath()));
    }
}
