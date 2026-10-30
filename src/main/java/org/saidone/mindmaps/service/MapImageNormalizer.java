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
import org.apache.batik.bridge.*;
import org.apache.batik.transcoder.SVGAbstractTranscoder;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;
import org.apache.batik.util.ParsedURL;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.Node;

import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.awt.image.IndexColorModel;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Component
@Slf4j
public class MapImageNormalizer {
    private static final int MAX_SIZE = 1024;
    private static final long MAX_PIXELS = 40_000_000;

    public ImageDownloadService.Download normalize(ImageDownloadService.Download source) {
        try {
            val bytes = source.mediaType().equals("image/svg+xml") ? rasterizeSvg(source.data()) : source.data();
            try (val input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                val readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new IllegalArgumentException("Unsupported image");
                val reader = readers.next();
                try {
                    reader.setInput(input);
                    if (source.mediaType().equals("image/gif") && reader.getNumImages(true) > 1) return resizeAnimation(reader);
                    val width = reader.getWidth(0);
                    val height = reader.getHeight(0);
                    if (width <= 0 || height <= 0) throw new IllegalArgumentException("Invalid image dimensions");
                    val scale = Math.min(1.0, (double) MAX_SIZE / Math.max(width, height));
                    val parameters = reader.getDefaultReadParam();
                    // Validate the raster that will actually be decoded. Large Wikimedia
                    // originals can be reduced directly by the reader without allocating
                    // their full-resolution bitmap (especially JPEG with native subsampling).
                    val sampling = Math.max(1, Math.max(width, height) / MAX_SIZE);
                    checkPixels((int) Math.ceil((double) width / sampling), (int) Math.ceil((double) height / sampling));
                    parameters.setSourceSubsampling(sampling, sampling, 0, 0);
                    val decoded = reader.read(0, parameters);
                    checkPixels(decoded.getWidth(), decoded.getHeight());
                    val image = resize(decoded, Math.max(1, (int) Math.round(width * scale)), Math.max(1, (int) Math.round(height * scale)), false);
                    return encode(image);
                } finally {
                    reader.dispose();
                }
            }
        } catch (Exception ex) {
            log.warn("Non riesco a normalizzare l’immagine (formato {}): {}", source.mediaType(), ex.toString());
            throw new ResponseStatusException(BAD_REQUEST, "Non riesco a preparare questa immagine. Prova un’altra immagine.", ex);
        }
    }

    private static void checkPixels(int width, int height) {
        if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) throw new IllegalArgumentException("Image too large");
    }

    private BufferedImage resize(BufferedImage source, int width, int height, boolean indexed) {
        val target = indexed
                ? new BufferedImage(width, height, BufferedImage.TYPE_BYTE_INDEXED, (IndexColorModel) source.getColorModel())
                : new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        val graphics = target.createGraphics();
        try {
            graphics.setComposite(AlphaComposite.Src);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    indexed ? RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR : RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private ImageDownloadService.Download encode(BufferedImage image) throws Exception {
        boolean transparent = false;
        for (int y = 0; y < image.getHeight() && !transparent; y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                if ((image.getRGB(x, y) >>> 24) != 255) { transparent = true; break; }
            }
        }
        BufferedImage output = image;
        if (!transparent) {
            output = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            val graphics = output.createGraphics();
            try { graphics.drawImage(image, 0, 0, null); } finally { graphics.dispose(); }
        }
        val writer = ImageIO.getImageWritersByFormatName(transparent ? "png" : "jpeg").next();
        try (val bytes = new ByteArrayOutputStream(); val stream = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(stream);
            val parameters = writer.getDefaultWriteParam();
            if (!transparent) {
                parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                parameters.setCompressionQuality(.85f);
            }
            writer.write(null, new IIOImage(output, null, null), parameters);
            stream.flush();
            return new ImageDownloadService.Download(bytes.toByteArray(), transparent ? "image/png" : "image/jpeg");
        } finally {
            writer.dispose();
        }
    }

    private byte[] rasterizeSvg(byte[] source) throws Exception {
        val factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // Commons SVGs may declare the standard SVG DTD. Accept the declaration
        // without loading its contents or allowing custom entity definitions.
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setExpandEntityReferences(false);
        factory.setXIncludeAware(false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        val document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(source));
        val doctype = document.getDoctype();
        if (doctype != null && doctype.getInternalSubset() != null && !doctype.getInternalSubset().isBlank()) {
            throw new IllegalArgumentException("Le definizioni XML interne non sono supportate nelle immagini SVG.");
        }
        if (doctype != null) document.removeChild(doctype);
        val transcoder = new PNGTranscoder() {
            @Override
            protected UserAgent createUserAgent() {
                return new SVGAbstractTranscoderUserAgent() {
                    @Override
                    public ScriptSecurity getScriptSecurity(String type, ParsedURL script, ParsedURL doc) {
                        return new NoLoadScriptSecurity(type);
                    }
                    @Override
                    public ExternalResourceSecurity getExternalResourceSecurity(ParsedURL resource, ParsedURL doc) {
                        return new NoLoadExternalResourceSecurity();
                    }
                };
            }
        };
        transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_MAX_WIDTH, (float) MAX_SIZE);
        transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_MAX_HEIGHT, (float) MAX_SIZE);
        transcoder.addTranscodingHint(SVGAbstractTranscoder.KEY_EXECUTE_ONLOAD, false);
        try (val bytes = new ByteArrayOutputStream()) {
            transcoder.transcode(new TranscoderInput(document), new TranscoderOutput(bytes));
            return bytes.toByteArray();
        }
    }

    private ImageDownloadService.Download resizeAnimation(ImageReader reader) throws Exception {
        val count = reader.getNumImages(true);
        if (count > 500) throw new IllegalArgumentException("Too many animation frames");
        val sourceMetadata = reader.getStreamMetadata();
        if (sourceMetadata == null) throw new IllegalArgumentException("Metadati dell’animazione GIF mancanti.");
        val streamTree = sourceMetadata.getAsTree("javax_imageio_gif_stream_1.0");
        if (streamTree == null) throw new IllegalArgumentException("Metadati dell’animazione GIF non validi.");
        val screen = child(streamTree, "LogicalScreenDescriptor");
        if (screen == null) throw new IllegalArgumentException("Descrittore delle dimensioni GIF mancante.");
        val width = number(screen, "logicalScreenWidth");
        val height = number(screen, "logicalScreenHeight");
        checkPixels(width, height);
        val scale = Math.min(1.0, (double) MAX_SIZE / Math.max(width, height));
        val targetWidth = Math.max(1, (int) Math.round(width * scale));
        val targetHeight = Math.max(1, (int) Math.round(height * scale));
        attribute(screen, "logicalScreenWidth", targetWidth);
        attribute(screen, "logicalScreenHeight", targetHeight);
        val writer = ImageIO.getImageWritersByFormatName("gif").next();
        val streamMetadata = writer.getDefaultStreamMetadata(null);
        streamMetadata.setFromTree("javax_imageio_gif_stream_1.0", streamTree);
        long pixels = 0;
        try (val bytes = new ByteArrayOutputStream(); val output = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(output);
            writer.prepareWriteSequence(streamMetadata);
            for (int i = 0; i < count; i++) {
                val frameWidth = reader.getWidth(i);
                val frameHeight = reader.getHeight(i);
                checkPixels(frameWidth, frameHeight);
                pixels += (long) frameWidth * frameHeight;
                if (pixels > 200_000_000) throw new IllegalArgumentException("Animation too large");
                val frameMetadata = reader.getImageMetadata(i);
                if (frameMetadata == null) throw new IllegalArgumentException("Metadati del frame GIF mancanti.");
                val tree = frameMetadata.getAsTree("javax_imageio_gif_image_1.0");
                if (tree == null) throw new IllegalArgumentException("Metadati del frame GIF non validi.");
                val descriptor = child(tree, "ImageDescriptor");
                if (descriptor == null) throw new IllegalArgumentException("Descrittore del frame GIF mancante.");
                val left = (int) Math.floor(number(descriptor, "imageLeftPosition") * scale);
                val top = (int) Math.floor(number(descriptor, "imageTopPosition") * scale);
                val frame = resize(reader.read(i), Math.clamp((int) Math.round(frameWidth * scale), 1, Math.max(1, targetWidth - left)),
                        Math.clamp((int) Math.round(frameHeight * scale), 1, Math.max(1, targetHeight - top)), true);
                attribute(descriptor, "imageLeftPosition", left);
                attribute(descriptor, "imageTopPosition", top);
                attribute(descriptor, "imageWidth", frame.getWidth());
                attribute(descriptor, "imageHeight", frame.getHeight());
                val comments = child(tree, "CommentExtensions");
                if (comments != null) tree.removeChild(comments);
                val metadata = writer.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(frame), null);
                metadata.setFromTree("javax_imageio_gif_image_1.0", tree);
                writer.writeToSequence(new IIOImage(frame, null, metadata), null);
            }
            writer.endWriteSequence();
            output.flush();
            return new ImageDownloadService.Download(bytes.toByteArray(), "image/gif");
        } finally {
            writer.dispose();
        }
    }

    private static Node child(Node root, String name) {
        for (Node node = root.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (name.equals(node.getNodeName())) return node;
        }
        return null;
    }

    private static int number(Node node, String attribute) {
        return Integer.parseInt(node.getAttributes().getNamedItem(attribute).getNodeValue());
    }

    private static void attribute(Node node, String name, int value) {
        node.getAttributes().getNamedItem(name).setNodeValue(Integer.toString(value));
    }
}
