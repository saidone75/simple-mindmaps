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
 * alolong with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.saidone.mindmaps.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.saidone.mindmaps.dto.NodeDto;
import org.saidone.mindmaps.model.Node;

@Mapper(componentModel = "spring")
public interface NodeMapper {

    @Mapping(target = "imageKeywords", ignore = true)
    NodeDto toDto(Node node);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "mapId", ignore = true)
    @Mapping(target = "parentId", ignore = true)
    void restore(NodeDto source, @MappingTarget Node target);

}
