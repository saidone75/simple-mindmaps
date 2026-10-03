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

import lombok.val;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginRateLimiterTest {

    @Test
    void blocksAfterFiveFailedAttemptsForTheSameUserAndAddress() {
        val limiter = new LoginRateLimiter();

        for (int attempt = 0; attempt < 5; attempt++) {
            assertThat(limiter.isBlocked("Alice", "127.0.0.1")).isFalse();
            limiter.recordFailure("Alice", "127.0.0.1");
        }

        assertThat(limiter.isBlocked(" alice ", "127.0.0.1")).isTrue();
        assertThat(limiter.isBlocked("Alice", "127.0.0.2")).isFalse();
        assertThat(limiter.isBlocked("Bob", "127.0.0.1")).isFalse();
    }

    @Test
    void successfulLoginClearsFailedAttempts() {
        val limiter = new LoginRateLimiter();

        for (int attempt = 0; attempt < 5; attempt++) {
            limiter.recordFailure("Alice", "127.0.0.1");
        }

        limiter.recordSuccess("Alice", "127.0.0.1");
        assertThat(limiter.isBlocked("Alice", "127.0.0.1")).isFalse();
    }

}
