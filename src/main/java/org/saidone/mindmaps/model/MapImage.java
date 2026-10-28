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
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "map_image")
@Getter
@Setter
public class MapImage {
    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private Instant createdAt;
    private Instant orphanedAt;

    @PrePersist
    public void prePersist() {
        createdAt = Instant.now();
    }

    @Column(nullable = false)
    private String mediaType;

    private String filePath;
}
