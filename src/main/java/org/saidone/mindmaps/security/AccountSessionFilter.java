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

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@RequiredArgsConstructor
public class AccountSessionFilter extends OncePerRequestFilter {
    public static final String VERSION = "accountSessionVersion";
    private final AppUserRepository users;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        val authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof org.springframework.security.core.userdetails.UserDetails) {
            val user = users.findByUsernameIgnoreCase(authentication.getName()).orElse(null);
            val session = request.getSession(false);
            val version = session == null ? null : session.getAttribute(VERSION);
            if (user == null || !user.isEnabled() || version != null && !version.equals(user.getSessionVersion())) {
                new SecurityContextLogoutHandler().logout(request, response, authentication);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessione scaduta. Accedi di nuovo.");
                return;
            }
            if (session != null && version == null) session.setAttribute(VERSION, user.getSessionVersion());
        }
        chain.doFilter(request, response);
    }
}
