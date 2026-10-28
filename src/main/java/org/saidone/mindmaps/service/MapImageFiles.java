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

import lombok.val;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.Arrays;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@Component
public class MapImageFiles {
    @Value("${app.upload.directory:./upload}")
    private String directory;

    public Path baseDirectory() {
        return Path.of(directory).toAbsolutePath().normalize();
    }

    public Path resolve(String fileName) {
        if (fileName == null) throw new ResponseStatusException(NOT_FOUND, "Immagine non disponibile");
        val path = baseDirectory().resolve(fileName).normalize();
        if (!path.startsWith(baseDirectory())) throw new ResponseStatusException(NOT_FOUND);
        return path;
    }

    public String write(String id, byte[] data, String mediaType) {
        val extension = switch (mediaType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/svg+xml" -> ".svg";
            default -> throw new ResponseStatusException(BAD_REQUEST, "Formato immagine non supportato");
        };
        val fileName = UUID.fromString(id) + extension;
        val destination = resolve(fileName);
        try {
            Files.createDirectories(baseDirectory());
            if (Files.exists(destination)) {
                if (!Arrays.equals(data, Files.readAllBytes(destination))) throw new IOException("Image filename conflict");
                return fileName;
            }
            val temporary = Files.createTempFile(baseDirectory(), "." + id, ".part");
            try {
                Files.write(temporary, data);
                try {
                    Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException ex) {
                    Files.move(temporary, destination);
                }
            } finally {
                Files.deleteIfExists(temporary);
            }
            return fileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Non riesco a salvare il file immagine sul server.", ex);
        }
    }

    public Resource load(String fileName) {
        val path = resolve(fileName);
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) throw new ResponseStatusException(NOT_FOUND, "File immagine non disponibile");
        return new FileSystemResource(path);
    }
}
