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

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.model.AppUser;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;
    private final org.saidone.mindmaps.repository.MindMapRepository maps;
    private final org.saidone.mindmaps.repository.NodeRepository nodes;

    @Transactional
    public AppUser createUser(String username, String rawPassword) {
        val normalizedUsername = normalizeUsername(username);
        validatePassword(rawPassword);
        if (appUserRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("Username già esistente");
        }

        val user = new AppUser();
        user.setUsername(normalizedUsername);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setEnabled(true);
        return appUserRepository.save(user);
    }

    @Transactional
    public void changePassword(String currentPassword, String newPassword, String confirmation) {
        val user = currentUserService.getCurrentUser();
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("La password attuale non è corretta.");
        }
        validatePassword(newPassword);
        if (!newPassword.equals(confirmation)) {
            throw new IllegalArgumentException("La conferma non corrisponde alla nuova password.");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("Scegli una password diversa da quella attuale.");
        }
        user.setSessionVersion(user.getSessionVersion() + 1);
        user.setPassword(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }

    @Transactional
    public void initializeAdministrator(String username) {
        val user = appUserRepository.findByUsernameIgnoreCase(username).orElseThrow();
        if (user.getRole() != AppUser.Role.ADMIN) {
            user.setRole(AppUser.Role.ADMIN);
            appUserRepository.save(user);
        }
    }

    public java.util.List<AppUser> listUsers() {
        currentUserService.requireManager();
        return appUserRepository.findAllByOrderByUsernameAsc();
    }

    @Transactional
    public void createManagedUser(String username, String password) {
        currentUserService.requireManager();
        val user = createUser(username, password);
        user.setAiEnabled(false);
        appUserRepository.save(user);
    }

    @Transactional
    public void updateUser(Long id, boolean enabled, boolean aiEnabled, boolean coAdmin) {
        val actor = currentUserService.requireManager();
        val user = managedTarget(id, actor);
        if (user.getRole() == AppUser.Role.ADMIN && !enabled
                && appUserRepository.countByRoleAndEnabledTrue(AppUser.Role.ADMIN) <= 1) {
            throw new IllegalArgumentException("Non puoi bloccare l’ultimo amministratore.");
        }
        if (user.isEnabled() != enabled) user.setSessionVersion(user.getSessionVersion() + 1);
        user.setEnabled(enabled);
        user.setAiEnabled(aiEnabled);
        if (user.getRole() != AppUser.Role.ADMIN) user.setRole(coAdmin ? AppUser.Role.CO_ADMIN : AppUser.Role.USER);
        appUserRepository.save(user);
    }

    @Transactional
    public void resetPassword(Long id, String password) {
        val actor = currentUserService.requireManager();
        val user = managedTarget(id, actor);
        validatePassword(password);
        user.setPassword(passwordEncoder.encode(password));
        user.setSessionVersion(user.getSessionVersion() + 1);
        appUserRepository.save(user);
    }

    @Transactional
    public void deleteUser(Long id, String confirmation) {
        val actor = currentUserService.requireManager();
        val user = managedTarget(id, actor);
        if (!user.getUsername().equals(confirmation)) throw new IllegalArgumentException("Conferma la cancellazione scrivendo il nome utente.");
        if (user.getRole() == AppUser.Role.ADMIN && user.isEnabled()
                && appUserRepository.countByRoleAndEnabledTrue(AppUser.Role.ADMIN) <= 1) {
            throw new IllegalArgumentException("Non puoi cancellare l’ultimo amministratore.");
        }
        for (val map : maps.findByOwnerUsernameIgnoreCaseOrderByUpdatedAtDesc(user.getUsername())) {
            nodes.deleteByMapId(map.getId());
            maps.delete(map);
        }
        appUserRepository.delete(user);
    }

    private AppUser managedTarget(Long id, AppUser actor) {
        if (actor.getId().equals(id)) throw new IllegalArgumentException("Usa il cambio password personale; le operazioni amministrative sono riservate agli altri utenti.");
        val user = appUserRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Utente non trovato."));
        if (actor.getRole() == AppUser.Role.CO_ADMIN && user.getRole() == AppUser.Role.ADMIN) {
            throw new IllegalArgumentException("Un co-amministratore non può modificare un amministratore.");
        }
        return user;
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username obbligatorio");
        }
        val normalized = username.trim().toLowerCase(java.util.Locale.ROOT);
        if (normalized.length() < 3 || normalized.length() > 80) {
            throw new IllegalArgumentException("Lo username deve contenere tra 3 e 80 caratteri");
        }
        if (!normalized.matches("[a-z0-9._@-]+")) {
            throw new IllegalArgumentException("Lo username contiene caratteri non validi");
        }
        return normalized;
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword != null && rawPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("La password è troppo lunga (massimo 72 byte UTF-8).");
        }
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("La password deve contenere almeno 8 caratteri");
        }
    }
}
