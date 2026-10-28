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
import java.util.Locale;

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
            val query = String.format("filemime:image -filemime:djvu -filemime:pdf %s %s", subject, words(detail));
            if (seen.add(query)) {
                contextual.add(query);
            }
        }
        if (!contextual.isEmpty()) {
            batches.add(List.copyOf(contextual));
        }
        // Drop trailing qualifiers in older, overly long subjects, retaining at least
        // two words so the fallback does not collapse to a generic civilization name.
        val subjectWords = subject.split("\\s+");
        for (int count = subjectWords.length; count >= Math.min(2, subjectWords.length); count--) {
            val relaxed = "filemime:image -filemime:djvu -filemime:pdf " + String.join(" ", Arrays.copyOf(subjectWords, count));
            if (seen.add(relaxed)) batches.add(List.of(relaxed));
        }
        // Documents are considered only after the searches for ordinary images.
        batches.add(List.of("filemime:image " + subject));
        return List.copyOf(batches);
    }

    private static String clean(String term) {
        // Treat generated keywords as literal words, never as search operators.
        return term.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").strip().replaceAll("\\s+", " ");
    }

    private static String words(String term) {
        // Leave words unquoted so Commons can also match grammatical variants.
        return String.join(" ", Arrays.stream(term.split("\\s+"))
                .distinct()
                .toList());
    }
}
