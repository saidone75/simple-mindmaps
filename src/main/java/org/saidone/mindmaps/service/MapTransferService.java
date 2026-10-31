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
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.model.MapImage;
import org.saidone.mindmaps.repository.MapImageRepository;
import org.saidone.mindmaps.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import java.util.zip.ZipEntry;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.function.UnaryOperator;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class MapTransferService {
    public static final int MAX_FILE_BYTES = 100 * 1024 * 1024;
    private static final int MAX_IMAGE_BYTES = 25 * 1024 * 1024;
    private static final Gson JSON = new Gson();
    private final MindMapService maps;
    private final MapImageRepository images;
    private final MapImageFiles files;
    private final MapImageNormalizer normalizer;
    private final CurrentUserService users;
    private final PlatformTransactionManager transactions;

    public record Asset(String mediaType, String base64) {}
    public record Document(String format, int version, MindMapDto map, Map<String, Asset> images) {}

    public record ZipAsset(String mediaType, String path) {}
    public record ZipDocument(String format, int version, MindMapDto map, Map<String, ZipAsset> images) {}

    public byte[] exportZip(Long id) throws IOException {
        val map = maps.findMapWithNodes(id);
        val assets = new LinkedHashMap<String, ZipAsset>();
        val sources = new LinkedHashSet<String>();
        transformImages(map, source -> {
            if (source != null && source.startsWith("/images/")) sources.add(source);
            return source;
        });
        val output = new ByteArrayOutputStream();
        long total = 0;
        try (val zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            for (val source : sources) {
                val image = images.findById(source.substring(8)).orElseThrow(() -> invalid("Un’immagine salvata non è disponibile."));
                val resource = files.load(image.getFilePath());
                if (resource.contentLength() > MAX_IMAGE_BYTES) throw invalid("Un’immagine supera il limite di 25 MB.");
                val data = resource.getInputStream();
                final byte[] bytes;
                try (data) { bytes = data.readNBytes(MAX_IMAGE_BYTES + 1); }
                if (bytes.length > MAX_IMAGE_BYTES) throw invalid("Un’immagine supera il limite di 25 MB.");
                total += bytes.length;
                if (total > MAX_FILE_BYTES) throw invalid("La mappa supera il limite di 100 MB decompressi.");
                val extension = switch (image.getMediaType()) {
                    case "image/jpeg" -> "jpg";
                    case "image/png" -> "png";
                    case "image/gif" -> "gif";
                    case "image/webp" -> "webp";
                    case "image/svg+xml" -> "svg";
                    default -> throw invalid("Formato immagine non supportato.");
                };
                val path = String.format("images/image-%d.%s", assets.size() + 1, extension);
                assets.put(source, new ZipAsset(image.getMediaType(), path));
                writeEntry(zip, path, bytes);
            }
            val manifest = JSON.toJson(new ZipDocument("alice-mindmap", 2, map, assets)).getBytes(StandardCharsets.UTF_8);
            if (total + manifest.length > MAX_FILE_BYTES) throw invalid("La mappa supera il limite di 100 MB decompressi.");
            writeEntry(zip, "map.json", manifest);
        }
        if (output.size() > MAX_FILE_BYTES) throw invalid("Il file della mappa supera il limite di 100 MB.");
        return output.toByteArray();
    }

    private static void writeEntry(ZipOutputStream zip, String path, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(bytes);
        zip.closeEntry();
    }

    private Map<String, byte[]> readArchive(byte[] data) {
        val entries = new LinkedHashMap<String, byte[]>();
        int total = 0;
        try (val zip = new ZipInputStream(new ByteArrayInputStream(data), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                val name = entry.getName();
                if (entry.isDirectory() && "images/".equals(name)) continue;
                if (entries.size() >= 10001 || entries.containsKey(name)
                        || !("map.json".equals(name) || name.matches("images/[a-zA-Z0-9_-]+\\.[a-zA-Z0-9]+"))) {
                    throw invalid("L’archivio contiene file o percorsi non validi.");
                }
                val limit = Math.min("map.json".equals(name) ? MAX_FILE_BYTES : MAX_IMAGE_BYTES, MAX_FILE_BYTES - total);
                val bytes = zip.readNBytes(limit + 1);
                if (bytes.length > limit) throw invalid("L’archivio supera i limiti di dimensione consentiti.");
                total += bytes.length;
                entries.put(name, bytes);
                zip.closeEntry();
            }
        } catch (IOException | IllegalArgumentException ex) {
            throw invalid("Il file ZIP non è valido o è danneggiato.");
        }
        if (!entries.containsKey("map.json")) throw invalid("Nell’archivio manca map.json.");
        return entries;
    }

    public byte[] exportMap(Long id) throws IOException {
        val map = maps.findMapWithNodes(id);
        val assets = new LinkedHashMap<String, Asset>();
        val size = new long[]{0};
        transformImages(map, source -> {
            if (source == null || !source.startsWith("/images/")) return source;
            if (!assets.containsKey(source)) {
                val image = images.findById(source.substring(8)).orElseThrow(() -> invalid("Un’immagine salvata non è disponibile."));
                try {
                    val resource = files.load(image.getFilePath());
                    if (resource.contentLength() > MAX_IMAGE_BYTES) throw invalid("Un’immagine supera il limite di 25 MB.");
                    val data = resource.getContentAsByteArray();
                    size[0] += ((long) data.length + 2) / 3 * 4;
                    if (size[0] > MAX_FILE_BYTES) throw invalid("La mappa contiene troppe immagini per un unico file da 100 MB.");
                    assets.put(source, new Asset(image.getMediaType(), Base64.getEncoder().encodeToString(data)));
                } catch (IOException ex) {
                    throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Non riesco a leggere un’immagine della mappa.", ex);
                }
            }
            return source;
        });
        val data = JSON.toJson(new Document("alice-mindmap", 1, map, assets)).getBytes(StandardCharsets.UTF_8);
        if (data.length > MAX_FILE_BYTES) throw invalid("Il file della mappa supera il limite di 100 MB.");
        return data;
    }

    public Long importMap(byte[] data) {
        if (data.length > MAX_FILE_BYTES) throw invalid("Il file della mappa supera il limite di 100 MB.");
        val archive = data.length >= 2 && data[0] == 'P' && data[1] == 'K' ? readArchive(data) : Map.<String, byte[]>of();
        final Document document;
        final ZipDocument zipDocument;
        try {
            if (archive.isEmpty()) {
                document = JSON.fromJson(new String(data, StandardCharsets.UTF_8), Document.class);
                zipDocument = null;
            } else {
                zipDocument = JSON.fromJson(new String(archive.get("map.json"), StandardCharsets.UTF_8), ZipDocument.class);
                if (zipDocument == null || zipDocument.version() != 2 || zipDocument.images() == null || zipDocument.images().size() > 10000) throw invalid("Formato ZIP non supportato.");
                document = new Document(zipDocument.format(), 1, zipDocument.map(), Map.of());
            }
        } catch (RuntimeException ex) {
            throw invalid("Il file non contiene una mappa valida.");
        }
        if (document == null || !"alice-mindmap".equals(document.format()) || document.version() != 1
                || document.map() == null || document.images() == null) throw invalid("Formato o versione della mappa non supportati.");
        val map = document.map();
        validate(map);
        if (document.images().size() > 10000) throw invalid("Il file contiene troppe immagini.");
        val prepared = new LinkedHashMap<String, ImageDownloadService.Download>();
        transformImages(map, source -> {
            if (source == null) return null;
            if (source.startsWith("/images/")) {
                if (!prepared.containsKey(source)) {
                    if (zipDocument != null) {
                        val asset = zipDocument.images().get(source);
                        if (asset == null || asset.path() == null || !asset.path().startsWith("images/")
                                || !archive.containsKey(asset.path())) throw invalid("Nel file manca un’immagine della mappa.");
                        prepared.put(source, normalize(asset.mediaType(), archive.get(asset.path())));
                    } else {
                        val asset = document.images().get(source);
                        if (asset == null || asset.mediaType() == null || asset.base64() == null) throw invalid("Nel file manca un’immagine della mappa.");
                        prepared.put(source, decode(asset.mediaType(), asset.base64()));
                    }
                }
            } else if (source.startsWith("data:")) {
                if (!prepared.containsKey(source)) {
                    val separator = source.indexOf(";base64,");
                    if (separator < 0) throw invalid("Immagine incorporata non valida.");
                    prepared.put(source, decode(source.substring(5, separator), source.substring(separator + 8)));
                }
            } else if (!source.matches("https?://[^\\s]+")) throw invalid("Link immagine non valido.");
            return source;
        });
        val owner = users.getCurrentUser();
        val written = new ArrayList<String>();
        try {
            val references = new HashMap<String, String>();
            val metadata = new ArrayList<MapImage>();
            for (val entry : prepared.entrySet()) {
                val image = new MapImage();
                image.setId(UUID.randomUUID().toString());
                image.setOwnerId(owner.getId());
                image.setMediaType(entry.getValue().mediaType());
                image.setFilePath(files.write(image.getId(), entry.getValue().data(), image.getMediaType()));
                written.add(image.getFilePath());
                metadata.add(image);
                references.put(entry.getKey(), String.format("/images/%s", image.getId()));
            }
            transformImages(map, source -> references.getOrDefault(source, source));
            return new TransactionTemplate(transactions).execute(status -> {
                images.saveAll(metadata);
                return maps.importMap(map);
            });
        } catch (RuntimeException ex) {
            for (val path : written) {
                try { Files.deleteIfExists(files.resolve(path)); }
                catch (IOException cleanup) { ex.addSuppressed(cleanup); }
            }
            throw ex;
        }
    }

    private ImageDownloadService.Download decode(String mediaType, String encoded) {
        if (encoded.length() > (MAX_IMAGE_BYTES + 2L) / 3 * 4) throw invalid("Un’immagine supera il limite di 25 MB.");
        final byte[] data;
        try { data = Base64.getDecoder().decode(encoded); }
        catch (IllegalArgumentException ex) { throw invalid("Immagine incorporata non valida."); }
        return normalize(mediaType, data);
    }

    private ImageDownloadService.Download normalize(String mediaType, byte[] data) {
        if (data.length > MAX_IMAGE_BYTES) throw invalid("Un’immagine supera il limite di 25 MB.");
        if (mediaType == null || !Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml").contains(mediaType)) throw invalid("Formato immagine non supportato.");
        return normalizer.normalize(new ImageDownloadService.Download(data, mediaType));
    }

    private void validate(MindMapDto map) {
        if (map.getTitle() == null || map.getTitle().isBlank() || map.getTitle().length() > 280
                || map.getNodes() == null || map.getNodes().isEmpty() || map.getNodes().size() > 1000) throw invalid("Titolo o numero di nodi non valido (massimo 1000).");
        if (map.getPrizes() != null && (map.getPrizes().size() != 5
                || map.getPrizes().stream().anyMatch(prize -> prize == null || prize.isBlank() || prize.length() > 120))) throw invalid("Titoli premio non validi.");
        val nodesById = new HashMap<Long, org.saidone.mindmaps.dto.NodeDto>();
        int roots = 0;
        for (val node : map.getNodes()) {
            if (node == null || node.getId() == null || nodesById.putIfAbsent(node.getId(), node) != null || node.getText() == null || node.getText().length() > 2000
                    || node.getX() == null || node.getY() == null || Math.abs((long) node.getX()) > 1000000 || Math.abs((long) node.getY()) > 1000000
                    || node.getImageCandidates() != null && node.getImageCandidates().size() > 9) throw invalid("Un nodo contiene dati non validi.");
            if (node.getFontSize() == null || node.getFontSize() < 8 || node.getFontSize() > 120
                    || node.getColor() == null || node.getColor().length() > 100
                    || node.getShape() == null || node.getShape().length() > 50
                    || node.getBranchColor() == null || node.getBranchColor().length() > 100
                    || node.getBranchStyle() == null || node.getBranchStyle().length() > 50
                    || tooLong(node.getDescription(), 2000) || tooLong(node.getHint(), 280)
                    || tooLong(node.getHint2(), 280) || tooLong(node.getHint3(), 280)
                    || tooLong(node.getBranchText(), 2000) || tooLong(node.getEmoji(), 100)
                    || tooLong(node.getTextColor(), 100)
                    || invalidSize(node.getNodeWidth()) || invalidSize(node.getNodeHeight())
                    || invalidSize(node.getImageWidth()) || invalidSize(node.getImageHeight())) throw invalid("Un nodo contiene dati non validi.");
            if (node.getParentId() == null) roots++;
        }
        if (roots != 1) throw invalid("La mappa deve avere un solo nodo principale.");
        for (val node : map.getNodes()) {
            val visited = new HashSet<Long>();
            var current = node;
            while (current != null) {
                if (!visited.add(current.getId())) throw invalid("I collegamenti della mappa contengono un ciclo.");
                val parent = current.getParentId();
                if (parent != null && !nodesById.containsKey(parent)) throw invalid("Manca un nodo collegato.");
                current = nodesById.get(parent);
            }
        }
    }

    private static boolean tooLong(String value, int limit) {
        return value != null && value.length() > limit;
    }

    private static boolean invalidSize(Integer size) {
        return size != null && (size < 1 || size > 1000);
    }

    private static void transformImages(MindMapDto map, UnaryOperator<String> transform) {
        for (val node : map.getNodes()) {
            node.setImageUri(transform.apply(node.getImageUri()));
            if (node.getImageCandidates() != null) node.setImageCandidates(node.getImageCandidates().stream().map(transform).toList());
        }
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(BAD_REQUEST, message);
    }
}
