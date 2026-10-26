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

import java.util.Set;

public interface WikimediaImageSearchService {

    default String searchImage(String[] keywords) {
        return searchImage(keywords, null, Set.of());
    }

    default String searchImage(String[] keywords, String preferredMode) {
        return searchImage(keywords, preferredMode, Set.of());
    }

    String searchImage(String[] keywords, String preferredMode, Set<String> excludedImageUrls);

}
