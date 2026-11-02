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

package org.saidone.mindmaps.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.security.CurrentUserService;
import org.saidone.mindmaps.security.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequiredArgsConstructor
public class UserPreferencesController {
    private final UserService users;
    private final CurrentUserService currentUser;

    @GetMapping("/preferences")
    public String preferences(Model model) {
        val account = currentUser.getCurrentUser();
        model.addAttribute("username", account.getUsername());
        model.addAttribute("account", account);
        if (account.isManager()) model.addAttribute("users", users.listUsers());
        return "preferences";
    }

    @PostMapping("/preferences/users/create")
    public String createUser(@RequestParam String username, @RequestParam String password,
                             RedirectAttributes redirect) {
        return manage(() -> users.createManagedUser(username, password), redirect);
    }

    @PostMapping("/preferences/users/{id}/update")
    public String updateUser(@PathVariable Long id,
                             @RequestParam(defaultValue = "false") boolean enabled,
                             @RequestParam(defaultValue = "false") boolean aiEnabled,
                             @RequestParam(defaultValue = "false") boolean coAdmin,
                             RedirectAttributes redirect) {
        return manage(() -> users.updateUser(id, enabled, aiEnabled, coAdmin), redirect);
    }

    @PostMapping("/preferences/users/{id}/password")
    public String resetPassword(@PathVariable Long id,
                                @RequestParam String password,
                                RedirectAttributes redirect) {
        return manage(() -> users.resetPassword(id, password), redirect);
    }

    @PostMapping("/preferences/users/{id}/delete")
    public String deleteUser(@PathVariable Long id,
                             @RequestParam String confirmation,
                             RedirectAttributes redirect) {
        return manage(() -> users.deleteUser(id, confirmation), redirect);
    }

    private String manage(Runnable action, RedirectAttributes redirect) {
        currentUser.requireManager();
        try {
            action.run();
            redirect.addFlashAttribute("userMessage", "Operazione completata.");
        } catch (IllegalArgumentException exception) {
            redirect.addFlashAttribute("userError", exception.getMessage());
        } catch (DataIntegrityViolationException exception) {
            redirect.addFlashAttribute("userError", "Operazione non riuscita: nome utente già presente o dati modificati. Ricarica la pagina.");
        }
        return "redirect:/preferences#users";
    }

    @PostMapping("/preferences/password")
    public String changePassword(@RequestParam String currentPassword,
                                 @RequestParam String newPassword,
                                 @RequestParam String confirmation,
                                 Model model, HttpServletRequest request, HttpServletResponse response,
                                 Authentication authentication) {
        try {
            users.changePassword(currentPassword, newPassword, confirmation);
        } catch (IllegalArgumentException exception) {
            model.addAttribute("passwordError", exception.getMessage());
            return preferences(model);
        }
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return "redirect:/login?passwordChanged";
    }
}
