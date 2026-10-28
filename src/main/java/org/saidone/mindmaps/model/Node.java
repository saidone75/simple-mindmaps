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

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "node")
public class Node {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mapId;

    private Long parentId;

    @Column(nullable = false)
    private String text;

    @Column
    private String description;

    @Column(length = 280)
    private String hint;

    @Column(length = 280)
    private String hint2;

    @Column(length = 280)
    private String hint3;

    private String emoji;

    private String branchText;

    @Column(nullable = false)
    private Integer x;

    @Column(nullable = false)
    private Integer y;

    @Column(nullable = false)
    private String color;

    private String textColor;

    @Column(nullable = false)
    private Integer fontSize;

    @Column(nullable = false)
    private String shape;

    @Column(nullable = false)
    private String branchColor;

    @Column(nullable = false)
    private String branchStyle;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String imageUri;

    private Integer imageWidth;

    private Integer imageHeight;

    private Integer nodeWidth;

    private Integer nodeHeight;
}
