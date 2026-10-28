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

package org.saidone.mindmaps.model;

import com.google.gson.Gson;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

@Converter
public class ImageCandidatesConverter implements AttributeConverter<List<String>, String> {
    private static final Gson JSON = new Gson();

    @Override
    public String convertToDatabaseColumn(List<String> candidates) {
        return candidates == null ? null : JSON.toJson(candidates);
    }

    @Override
    public List<String> convertToEntityAttribute(String value) {
        return value == null || value.isBlank() ? new ArrayList<>()
                : new ArrayList<>(Arrays.asList(JSON.fromJson(value, String[].class)));
    }
}
