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
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.Semaphore;

@Service
@Primary
@RequiredArgsConstructor
@Slf4j
public class WikimediaImageSearchSelectorService implements WikimediaImageSearchService {

    private static final String MODE_SIMPLE = "simple";
    private static final String MODE_ADVANCED = "advanced";
    private static final int MAX_CONCURRENT_SEARCHES = 3;

    private final WikimediaSimpleImageSearchService simpleImageFinderService;
    private final WikimediaSemanticImageSearchService advancedImageFinderService;
    private final Semaphore searchSemaphore = new Semaphore(MAX_CONCURRENT_SEARCHES, true);

    @Override
    public String searchImage(String[] keywords, String preferredMode, Set<String> excludedImageUrls) {
        try {
            searchSemaphore.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("La ricerca su Wikimedia è stata interrotta mentre attendeva di poter iniziare: {}", e.getMessage());
            return null;
        }

        try {
            val mode = resolveMode(preferredMode);
            log.debug("Cerco immagini su Wikimedia con la ricerca {}. Escludo {} immagini già usate nella mappa.",
                    MODE_ADVANCED.equals(mode) ? "basata sul significato dei testi" : "semplice", excludedImageUrls.size());
            if (MODE_SIMPLE.equals(mode)) {
                return simpleImageFinderService.searchImage(keywords, mode, excludedImageUrls);
            }
            return advancedImageFinderService.searchImage(keywords, mode, excludedImageUrls);
        } finally {
            searchSemaphore.release();
        }
    }

    private String resolveMode(String preferredMode) {
        if (preferredMode != null && !preferredMode.isBlank()) {
            val normalizedPreferredMode = preferredMode.trim().toLowerCase();
            if (MODE_SIMPLE.equals(normalizedPreferredMode) || MODE_ADVANCED.equals(normalizedPreferredMode)) {
                return normalizedPreferredMode;
            }
            log.warn("La modalità '{}' non è riconosciuta: uso la ricerca basata sul significato dei testi.", preferredMode);
            return MODE_ADVANCED;
        }

        return MODE_ADVANCED;
    }

}
