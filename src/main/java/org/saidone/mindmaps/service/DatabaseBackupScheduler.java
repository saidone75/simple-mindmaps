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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;

@Slf4j
@RequiredArgsConstructor
@Component
@ConditionalOnProperty(prefix = "app.db-backup", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DatabaseBackupScheduler {

    private static final String SQLITE_JDBC_PREFIX = "jdbc:sqlite:";
    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    private final DataSource dataSource;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.db-backup.directory:./backup}")
    private String backupDirectory;

    @Value("${app.db-backup.retention-count:30}")
    private int retentionCount;

    @Scheduled(cron = "${app.db-backup.cron:0 0 2 * * *}")
    public void backupDatabase() {
        Path temporaryBackup = null;
        try {
            val sourceDbPath = resolveSqliteFilePath();
            if (sourceDbPath == null) {
                return;
            }

            if (!Files.exists(sourceDbPath)) {
                log.warn("Backup del database non eseguito. File SQLite non trovato in {}", sourceDbPath);
                return;
            }

            val backupDirPath = Path.of(backupDirectory).toAbsolutePath().normalize();
            Files.createDirectories(backupDirPath);

            val sourceFileName = sourceDbPath.getFileName().toString();
            val baseName = sourceFileName.endsWith(".db")
                    ? sourceFileName.substring(0, sourceFileName.length() - 3)
                    : sourceFileName;

            val timestamp = LocalDateTime.now(ZoneId.systemDefault()).format(TIMESTAMP_FORMATTER);
            val backupFile = backupDirPath.resolve(String.format("%s-%s.db", baseName, timestamp));
            temporaryBackup = Files.createTempFile(backupDirPath, String.format("%s-", baseName), ".tmp");

            // Use a dedicated pool checkout, outside any Spring-managed transaction.
            try (val connection = dataSource.getConnection()) {
                if (!connection.getAutoCommit()) {
                    throw new SQLException("Il backup richiede una connessione fuori da una transazione.");
                }
                try (val statement = connection.prepareStatement("VACUUM main INTO ?")) {
                    statement.setString(1, temporaryBackup.toString());
                    statement.execute();
                }
            }
            validateBackup(temporaryBackup);
            Files.move(temporaryBackup, backupFile, StandardCopyOption.ATOMIC_MOVE);
            temporaryBackup = null;
            log.info("Backup del database completato: {}", backupFile);

            cleanupOldBackups(backupDirPath, baseName);
        } catch (Exception ex) {
            log.error("Backup del database fallito.", ex);
        } finally {
            if (temporaryBackup != null) {
                try {
                    Files.deleteIfExists(temporaryBackup);
                } catch (IOException ex) {
                    log.warn("Impossibile eliminare il backup temporaneo {}", temporaryBackup, ex);
                }
            }
        }
    }

    void validateBackup(Path backupFile) throws SQLException {
        try (val connection = DriverManager.getConnection(String.format("%s%s", SQLITE_JDBC_PREFIX, backupFile));
             val statement = connection.createStatement();
             val result = statement.executeQuery("PRAGMA integrity_check")) {
            if (!result.next() || !"ok".equalsIgnoreCase(result.getString(1)) || result.next()) {
                throw new SQLException("Controllo di integrità del backup SQLite fallito.");
            }
        }
    }

    private Path resolveSqliteFilePath() {
        if (datasourceUrl == null || !datasourceUrl.startsWith(SQLITE_JDBC_PREFIX)) {
            log.debug("Backup del database non eseguito. Il datasource non è SQLite: {}", datasourceUrl);
            return null;
        }

        val dbPathString = datasourceUrl.substring(SQLITE_JDBC_PREFIX.length());
        if (dbPathString.isBlank() || ":memory:".equalsIgnoreCase(dbPathString)) {
            log.debug("Backup del database non eseguito. Il datasource SQLite è in memoria.");
            return null;
        }

        return Path.of(dbPathString).toAbsolutePath().normalize();
    }

    private void cleanupOldBackups(Path backupDirPath, String baseName) throws IOException {
        if (retentionCount < 1) {
            return;
        }

        try (val pathStream = Files.list(backupDirPath)) {
            val backups = pathStream
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        val filename = path.getFileName().toString();
                        return filename.startsWith(String.format("%s-", baseName)) && filename.endsWith(".db");
                    })
                    .sorted(Comparator.comparing(Path::getFileName).reversed())
                    .toList();

            for (int i = retentionCount; i < backups.size(); i++) {
                Files.deleteIfExists(backups.get(i));
                log.info("Cancellato un vecchio backup del database: {}", backups.get(i));
            }
        }
    }
}
