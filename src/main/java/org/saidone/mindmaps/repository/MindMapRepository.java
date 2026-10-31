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

package org.saidone.mindmaps.repository;

import org.saidone.mindmaps.model.MindMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MindMapRepository extends JpaRepository<MindMap, Long> {
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update MindMap m set m.displayOrder = :position where m.id = :id and m.owner.id = :ownerId")
    int updateDisplayOrder(@org.springframework.data.repository.query.Param("id") Long id,
                           @org.springframework.data.repository.query.Param("ownerId") Long ownerId,
                           @org.springframework.data.repository.query.Param("position") int position);

    Optional<MindMap> findByPublicToken(String publicToken);
    List<MindMap> findByOwnerIdAndPublicTokenIsNotNullAndPublishedSnapshotIsNotNullOrderByUpdatedAtDesc(Long ownerId);
    List<MindMap> findByOwnerUsernameIgnoreCaseOrderByUpdatedAtDesc(String username);
    Optional<MindMap> findByIdAndOwnerUsernameIgnoreCase(Long id, String username);
}
