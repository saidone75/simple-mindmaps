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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

/** Keeps the primary subject mandatory while progressively relaxing extra details. */
final class WikimediaImageQueries {
    private WikimediaImageQueries() {
    }

    static List<List<String>> batches(List<String> keywords) {
        val cleaned = keywords.stream()
                .filter(term -> term != null && !term.isBlank())
                .map(WikimediaImageQueries::clean)
                .filter(term -> !term.isBlank())
                .distinct()
                .toList();
        if (cleaned.isEmpty()) {
            return List.of();
        }
        val subject = words(cleaned.getFirst());
        val batches = new ArrayList<List<String>>();
        val seen = new LinkedHashSet<String>();
        val contextual = new ArrayList<String>();
        for (val detail : cleaned.subList(1, cleaned.size())) {
            val query = String.format("filemime:image %s %s", subject, words(detail));
            if (seen.add(query)) {
                contextual.add(query);
            }
        }
        if (!contextual.isEmpty()) {
            batches.add(List.copyOf(contextual));
        }
        val relaxed = String.format("filemime:image %s", subject);
        if (seen.add(relaxed)) {
            batches.add(List.of(relaxed));
        }
        return List.copyOf(batches);
    }

    private static String clean(String term) {
        // Treat generated keywords as literal words, never as search operators.
        return term.replaceAll("[^\\p{L}\\p{N}\\s]", " ").strip().replaceAll("\\s+", " ");
    }

    private static String words(String term) {
        // Require every word without requiring an exact phrase or interpreting search operators.
        return String.join(" ", Arrays.stream(term.split("\\s+"))
                .distinct()
                .map(word -> String.format("\"%s\"", word))
                .toList());
    }
}
