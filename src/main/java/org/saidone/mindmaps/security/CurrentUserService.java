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

package org.saidone.mindmaps.security;

import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.model.AppUser;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final AppUserRepository appUserRepository;

    public AppUser getCurrentUser() {
        val authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(UNAUTHORIZED, "Utente non autenticato");
        }
        return appUserRepository.findByUsernameIgnoreCase(authentication.getName()).filter(AppUser::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Utente non trovato"));
    }
    public AppUser requireManager() {
        val user = getCurrentUser();
        if (!user.isManager()) throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Operazione riservata agli amministratori.");
        return user;
    }

    public void requireAi() {
        if (!getCurrentUser().isAiEnabled()) throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Generazione AI non abilitata per questo account.");
    }
}
