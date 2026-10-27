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
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.*;
import org.saidone.mindmaps.service.MindMapExportRenderer;
import org.saidone.mindmaps.service.MindMapService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class MindMapRestController {

    private final MindMapService mindMapService;
    private final MindMapExportRenderer mindMapExportRenderer;

    private static final Slugify SLG = Slugify.builder().build();

    @GetMapping("/maps/{id}")
    public MindMapDto getMap(@PathVariable Long id) {
        return mindMapService.findMapWithNodes(id);
    }

    @PostMapping("/maps/{id}/nodes")
    public NodeDto addNode(@PathVariable Long id, @RequestBody CreateNodeRequest request) {
        return mindMapService.addNode(id, request);
    }

    @PutMapping("/nodes/{nodeId}")
    public NodeDto updateNode(@PathVariable Long nodeId, @RequestBody UpdateNodeRequest request) {
        return mindMapService.updateNode(nodeId, request);
    }

    @PutMapping("/maps/{id}/style")
    public MindMapDto updateMapStyle(@PathVariable Long id, @RequestBody UpdateMapStyleRequest request) {
        return mindMapService.updateMapStyle(id, request.getStylePreset());
    }

    @PutMapping("/maps/{id}/background")
    public MindMapDto updateMapBackground(@PathVariable Long id, @RequestBody UpdateMapBackgroundRequest request) {
        return mindMapService.updateMapBackground(id, request.getBackgroundColor());
    }

    @PutMapping("/maps/{id}/title")
    public MindMapDto updateMapTitle(@PathVariable Long id, @RequestBody UpdateMapTitleRequest request) {
        return mindMapService.updateMapTitle(id, request.getTitle());
    }

    @DeleteMapping("/nodes/{nodeId}")
    public void deleteNode(@PathVariable Long nodeId) {
        mindMapService.deleteNode(nodeId);
    }


    @PostMapping(value = "/maps/{id}/export/png", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> exportPngFromCanvas(@PathVariable Long id, @RequestBody ExportSvgRequest request) throws Exception {
        val map = mindMapService.findMapWithNodes(id);
        val pngBytes = mindMapExportRenderer.renderSvgPng(request == null ? null : request.getSvg());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s.png".formatted(SLG.slugify(map.getTitle())))
                .body(pngBytes);
    }

    @PostMapping(value = "/maps/{id}/export/pdf", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPdfFromCanvas(@PathVariable Long id,
                                                      @RequestParam(defaultValue = "a4") String format,
                                                      @RequestBody ExportSvgRequest request) throws Exception {
        val map = mindMapService.findMapWithNodes(id);
        val normalizedFormat = mindMapExportRenderer.normalizePdfFormat(format);
        val pdfBytes = mindMapExportRenderer.renderSvgPdf(request == null ? null : request.getSvg(), normalizedFormat);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s-%s.pdf".formatted(SLG.slugify(map.getTitle()), normalizedFormat))
                .body(pdfBytes);
    }

}
