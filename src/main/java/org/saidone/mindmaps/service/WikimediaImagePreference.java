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

import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/** Document previews and explicitly labelled covers are last-resort alternatives. */
final class WikimediaImagePreference {
    private static final Pattern COVER = Pattern.compile(
            "\\b(book cover|bookcover|front cover|back cover|cover page|title page|titlepage|frontispiece|frontispizio|copertina|book jacket|cover of)\\b");

    private WikimediaImagePreference() {}

    static boolean isFallback(String title, String mime, String url, String description) {
        if (WikimediaDjvuPreview.isDjvu(title, mime, url)) return true;
        return COVER.matcher(text(title)).find() || COVER.matcher(text(description)).find();
    }

    private static String text(String value) {
        return Objects.toString(value, "").toLowerCase(Locale.ROOT)
                .replaceAll("<[^>]*>", " ").replaceAll("[^\\p{L}\\p{N}]+", " ");
    }
}
