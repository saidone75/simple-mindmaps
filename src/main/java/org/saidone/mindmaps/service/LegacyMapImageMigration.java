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
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;

/** Preserves images saved during the initial database-binary implementation. */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class LegacyMapImageMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final MapImageFiles files;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        try (val connection = jdbc.getDataSource().getConnection()) {
            if (!connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("SQLite")) return;
        }
        val columns = jdbc.queryForList("PRAGMA table_info(map_image)");
        if (columns.stream().noneMatch(column -> "data".equals(column.get("name")))) return;
        record Converted(String id, String fileName) {}
        val converted = new ArrayList<Converted>();
        jdbc.query("SELECT id, media_type, file_path, data FROM map_image", (org.springframework.jdbc.core.RowCallbackHandler) row -> {
            val bytes = row.getBytes("data"); // SQLite supports getBytes, not getBlob.
            val fileName = bytes == null ? row.getString("file_path")
                    : files.write(row.getString("id"), bytes, row.getString("media_type"));
            files.load(fileName); // Never remove the old bytes without a readable file.
            converted.add(new Converted(row.getString("id"), fileName));
        });
        for (val image : converted) jdbc.update("UPDATE map_image SET file_path = ? WHERE id = ?", image.fileName(), image.id());
        jdbc.execute("ALTER TABLE map_image DROP COLUMN data");
        log.info("Immagini trasferite dal database alla cartella del server: {}", converted.size());
    }
}
