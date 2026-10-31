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

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "mind_map", indexes = @Index(name = "idx_mind_map_public_token", columnList = "public_token", unique = true))
public class MindMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private Integer displayOrder;

    @Column
    private String stylePreset;

    private String backgroundColor;
    private Boolean storeImagesLocally;

    @Lob
    @Column(name = "game_titles", columnDefinition = "CLOB")
    private String prizesJson;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;

    @Column(name = "public_token")
    private String publicToken;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String publishedSnapshot;

    @PrePersist
    public void prePersist() {
        if (stylePreset == null || stylePreset.isBlank()) {
            stylePreset = "CLASSIC";
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        if (stylePreset == null || stylePreset.isBlank()) {
            stylePreset = "CLASSIC";
        }
        updatedAt = LocalDateTime.now();
    }

}
