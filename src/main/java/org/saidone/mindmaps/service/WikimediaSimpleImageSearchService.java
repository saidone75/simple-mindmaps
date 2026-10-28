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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class WikimediaSimpleImageSearchService implements WikimediaImageSearchService {

    private static final int MAX_KEYWORDS = 4;
    private static final Set<String> ALLOWED_WEB_IMAGE_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml"
    );
    private static final Set<String> ALLOWED_WEB_IMAGE_EXTENSIONS = Set.of(
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".svg"
    );

    @Qualifier("wikimediaRestClient")
    private final RestClient wikimediaRestClient;
    private final ObjectMapper objectMapper;

    @Override
    public String searchImage(String[] keywords, String preferredMode, Set<String> excludedImageUrls) {
        val images = searchImages(keywords, preferredMode, excludedImageUrls);
        return images.isEmpty() ? null : images.getFirst();
    }

    @Override
    public List<String> searchImages(String[] keywords, String preferredMode, Set<String> excludedImageUrls) {
        if (!hasKeywords(keywords)) {
            return List.of();
        }

        val normalizedKeywords = Arrays.stream(keywords)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .limit(MAX_KEYWORDS)
                .toArray(String[]::new);

        if (normalizedKeywords.length == 0) {
            return List.of();
        }

        log.debug("Ricerca immagine per: {}", String.join(", ", keywords));

        val images = new LinkedHashSet<String>();
        val seenFiles = new HashSet<String>();
        val fallbackImages = new LinkedHashSet<String>();
        try {
            for (val queryTerms : buildSearchQueries(normalizedKeywords)) {
                images.addAll(searchMatchingImageUrls(queryTerms, excludedImageUrls, MAX_IMAGES - images.size(), seenFiles, fallbackImages));
                if (images.size() >= MAX_IMAGES) break;
            }
        } catch (Exception e) {
            log.warn("Errore durante la ricerca immagine su Wikimedia: {}", e.getMessage());
        }
        log.debug("Ho trovato {} foto o illustrazioni e {} copertine o anteprime di documenti, tenute come ultima alternativa.",
                images.size(), fallbackImages.size());
        images.addAll(fallbackImages);
        return images.stream().limit(MAX_IMAGES).toList();
    }

    private boolean hasKeywords(String[] keywords) {
        return keywords != null && keywords.length > 0;
    }

    private List<String> searchMatchingImageUrls(String queryTerms, Set<String> excludedImageUrls, int limit, Set<String> seenFiles, Set<String> fallbackImages) throws Exception {
        val searchRoot = wikimediaRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("action", "query")
                        .queryParam("list", "search")
                        .queryParam("srsearch", queryTerms)
                        .queryParam("srnamespace", "6")
                        .queryParam("format", "json")
                        .queryParam("srlimit", "10")
                        .build())
                .retrieve()
                .body(String.class);

        val searchResponse = objectMapper.readValue(searchRoot, SearchApiResponse.class);
        val images = new LinkedHashSet<String>();
        for (val result : searchResponse.searchResults()) {
            if (!seenFiles.add(result.title())) continue;
            val image = resolveImageUrl(result.title());
            if (image != null && !excludedImageUrls.contains(image.url())) {
                if (image.fallback()) fallbackImages.add(image.url());
                else images.add(image.url());
                if (images.size() >= limit) break;
            }
        }
        return List.copyOf(images);
    }

    private record ResolvedImage(String url, boolean fallback) {}

    private ResolvedImage resolveImageUrl(String fileTitle) throws Exception {
        if (!StringUtils.hasText(fileTitle)) {
            return null;
        }

        val infoRoot = wikimediaRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("action", "query")
                        .queryParam("titles", fileTitle)
                        .queryParam("prop", "imageinfo")
                        .queryParam("iiprop", "url|mime|thumbmime")
                        .queryParam("iiurlwidth", "1024")
                        .queryParam("format", "json")
                        .build())
                .retrieve()
                .body(String.class);

        val infoResponse = objectMapper.readValue(infoRoot, ImageInfoApiResponse.class);
        val firstImageInfo = infoResponse.firstImageInfo();
        if (firstImageInfo == null) {
            return null;
        }

        if (WikimediaDjvuPreview.isDjvu(fileTitle, firstImageInfo.mime(), firstImageInfo.url())) {
            val preview = WikimediaDjvuPreview.resolve(firstImageInfo.thumburl(), firstImageInfo.thumbmime());
            return preview == null ? null : new ResolvedImage(preview, true);
        }

        val mimeType = firstImageInfo.mime();
        val imageUrl = firstImageInfo.url();
        return isWebImage(mimeType, imageUrl) ? new ResolvedImage(imageUrl,
                WikimediaImagePreference.isFallback(fileTitle, mimeType, imageUrl, null)) : null;
    }

    private List<String> buildSearchQueries(String[] normalizedKeywords) {
        return WikimediaImageQueries.batches(Arrays.asList(normalizedKeywords)).stream()
                .flatMap(List::stream)
                .toList();
    }

    private boolean isWebImage(String mimeType, String imageUrl) {
        if (!StringUtils.hasText(imageUrl)) {
            return false;
        }

        if (StringUtils.hasText(mimeType)) {
            return ALLOWED_WEB_IMAGE_MIME_TYPES.contains(mimeType.toLowerCase(Locale.ROOT));
        }

        val normalizedUrl = imageUrl.toLowerCase(Locale.ROOT);
        return ALLOWED_WEB_IMAGE_EXTENSIONS.stream()
                .anyMatch(normalizedUrl::endsWith);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record SearchApiResponse(Query query) {
        List<SearchResult> searchResults() {
            if (query == null || query.search == null) {
                return List.of();
            }
            return query.search;
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        private record Query(List<SearchResult> search) {
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record SearchResult(String title) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ImageInfoApiResponse(Query query) {
        ImageInfo firstImageInfo() {
            if (query == null || query.pages == null || query.pages.isEmpty()) {
                return null;
            }

            for (val page : query.pages.values()) {
                if (page == null || page.imageInfo == null || page.imageInfo.isEmpty()) {
                    continue;
                }
                return page.imageInfo.getFirst();
            }

            return null;
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        private record Query(Map<String, Page> pages) {
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        private record Page(@JsonProperty("imageinfo") List<ImageInfo> imageInfo) {
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ImageInfo(String url, String mime, String thumburl, String thumbmime) {
    }

}
