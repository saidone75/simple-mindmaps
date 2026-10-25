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

import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Component
public class MindMapExportRenderer {

    private static final String APP_CSS_RESOURCE = "static/css/app.css";
    private static final Set<String> SUPPORTED_PDF_FORMATS = Set.of("a4", "a3", "letter", "legal");
    private static final Pattern CSS_VARIABLE_PATTERN = Pattern.compile("var\\(\\s*+--([A-Za-z0-9_-]++)\\s*+(?:,([^)]*+))?\\)");
    private static final Pattern CSS_VARIABLE_DECLARATION_PATTERN = Pattern.compile("(?<![A-Za-z0-9_-])--([A-Za-z0-9_-]++)\\s*+:([^;]++);");

    private final Map<String, String> exportCssVariables;

    public MindMapExportRenderer() {
        this.exportCssVariables = loadCssVariables();
    }

    public byte[] renderSvgPng(String svg) throws TranscoderException, IOException {
        if (!StringUtils.hasText(svg)) {
            throw new IllegalArgumentException("SVG payload is required for PNG export");
        }

        val exportSafeSvg = replaceCssVariables(svg);

        try (val output = new ByteArrayOutputStream()) {
            val transcoderInput = new TranscoderInput(new ByteArrayInputStream(exportSafeSvg.getBytes(StandardCharsets.UTF_8)));
            val transcoderOutput = new TranscoderOutput(output);
            val transcoder = new PNGTranscoder();
            transcoder.transcode(transcoderInput, transcoderOutput);
            return output.toByteArray();
        }
    }

    public byte[] renderSvgPdf(String svg, String format) throws TranscoderException, IOException {
        val pngBytes = renderSvgPng(svg);
        val image = ImageIO.read(new ByteArrayInputStream(pngBytes));
        if (image == null) {
            throw new IllegalStateException("Unable to decode generated PNG for PDF export");
        }

        val pageSize = resolvePageSize(normalizePdfFormat(format));

        try (val document = new PDDocument(); val pdfOutput = new ByteArrayOutputStream()) {
            val page = new PDPage(pageSize);
            document.addPage(page);

            val pdImage = LosslessFactory.createFromImage(document, image);
            drawCenteredImage(document, page, pdImage, image);

            document.save(pdfOutput);
            return pdfOutput.toByteArray();
        }
    }

    String replaceCssVariables(String svg) {
        return replaceCssVariables(svg, exportCssVariables, 0);
    }

    private static String replaceCssVariables(String value, Map<String, String> cssVariables, int depth) {
        if (!StringUtils.hasText(value) || depth > 10) {
            return value;
        }

        val matcher = CSS_VARIABLE_PATTERN.matcher(value);
        val result = new StringBuilder();
        while (matcher.find()) {
            val variableName = matcher.group(1);
            val fallback = matcher.group(2);
            var replacement = cssVariables.get(variableName);
            if (!StringUtils.hasText(replacement)) {
                replacement = StringUtils.hasText(fallback) ? fallback.trim() : "#000000";
            }
            matcher.appendReplacement(result, java.util.regex.Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);

        val replaced = result.toString();
        return CSS_VARIABLE_PATTERN.matcher(replaced).find()
                ? replaceCssVariables(replaced, cssVariables, depth + 1)
                : replaced;
    }

    public String normalizePdfFormat(String rawFormat) {
        if (!StringUtils.hasText(rawFormat)) {
            return "a4";
        }
        val normalized = rawFormat.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_PDF_FORMATS.contains(normalized) ? normalized : "a4";
    }

    private Map<String, String> loadCssVariables() {
        try {
            val css = new ClassPathResource(APP_CSS_RESOURCE).getContentAsString(StandardCharsets.UTF_8);
            return resolveCssVariableDeclarations(css);
        } catch (IOException exception) {
            log.warn("Unable to load CSS variables for SVG export from {}", APP_CSS_RESOURCE, exception);
            return Map.of();
        }
    }

    private static Map<String, String> resolveCssVariableDeclarations(String css) {
        val rawVariables = new HashMap<String, String>();
        val matcher = CSS_VARIABLE_DECLARATION_PATTERN.matcher(css);
        while (matcher.find()) {
            rawVariables.put(matcher.group(1), matcher.group(2).trim());
        }

        val resolvedVariables = new HashMap<String, String>();
        for (val entry : rawVariables.entrySet()) {
            resolvedVariables.put(entry.getKey(), replaceCssVariables(entry.getValue(), rawVariables, 0));
        }
        return Map.copyOf(resolvedVariables);
    }

    private PDRectangle resolvePageSize(String format) {
        return switch (format) {
            case "a3" -> PDRectangle.A3;
            case "letter" -> PDRectangle.LETTER;
            case "legal" -> PDRectangle.LEGAL;
            default -> PDRectangle.A4;
        };
    }

    private void drawCenteredImage(PDDocument document, PDPage page, PDImageXObject pdImage, BufferedImage image) throws IOException {
        val pageWidth = page.getMediaBox().getWidth();
        val pageHeight = page.getMediaBox().getHeight();

        val imageWidth = (float) image.getWidth();
        val imageHeight = (float) image.getHeight();

        val scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
        val drawWidth = imageWidth * scale;
        val drawHeight = imageHeight * scale;

        val offsetX = (pageWidth - drawWidth) / 2;
        val offsetY = (pageHeight - drawHeight) / 2;

        try (val content = new PDPageContentStream(document, page)) {
            content.drawImage(pdImage, offsetX, offsetY, drawWidth, drawHeight);
        }
    }

}
