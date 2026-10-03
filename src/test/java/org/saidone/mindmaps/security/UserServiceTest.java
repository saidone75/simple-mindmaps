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
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

@DataJpaTest(properties = {
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Import({UserService.class, UserServiceTest.PasswordEncoderTestConfig.class})
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void createUserPersistsNormalizedLoginAndEncodedPassword() {
        val user = userService.createUser(" Alice@example.COM ", "secret-password");
        assertThat(user.getId()).isNotNull();
        assertThat(user.getUsername()).isEqualTo("alice@example.com");
        assertThat(user.getPassword()).isNotEqualTo("secret-password");
        assertThat(passwordEncoder.matches("secret-password", user.getPassword())).isTrue();
        assertThat(user.isEnabled()).isTrue();
        assertThat(appUserRepository.findByUsernameIgnoreCase("ALICE@example.com")).contains(user);
    }

    @Test
    void createUserRejectsDuplicateLoginIgnoringCase() {
        userService.createUser("alice", "secret-password");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> userService.createUser("ALICE", "other-password"))
                .withMessage("Username already in use");
    }

    @TestConfiguration
    static class PasswordEncoderTestConfig {
        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder();
        }
    }

}
