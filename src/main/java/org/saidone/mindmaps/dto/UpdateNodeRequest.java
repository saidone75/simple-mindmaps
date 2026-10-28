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

package org.saidone.mindmaps.dto;

import lombok.Data;

@Data
public class UpdateNodeRequest {
    private String text;
    private String description;
    private String hint;
    private String hint2;
    private String hint3;
    private String emoji;
    private String branchText;
    private Integer x;
    private Integer y;
    private String color;

    private String textColor;
    private Integer fontSize;
    private String shape;
    private String branchColor;
    private String branchStyle;
    private Integer branchWidth;
    private String branchCurve;
    private String imageUri;
    private Integer imageWidth;
    private Integer imageHeight;
    private Integer nodeWidth;
    private Integer nodeHeight;
}
