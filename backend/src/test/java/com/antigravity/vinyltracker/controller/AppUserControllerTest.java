package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.TokenEncryptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AppUserControllerTest {

        private MockMvc mockMvc;

        @Mock
        private AppUserRepository userRepository;

        @Mock
        private PasswordEncoder passwordEncoder;

        @Mock
        private TokenEncryptionService tokenService;

        @InjectMocks
        private AppUserController userController;

        private ObjectMapper objectMapper = new ObjectMapper();

        @BeforeEach
        void setUp() {
                mockMvc = MockMvcBuilders.standaloneSetup(userController).build();
        }

        @Test
        void register_ShouldReturnSavedUser_WithoutSensitiveData() throws Exception {
                Map<String, String> payload = Map.of("username", "newUser", "password", "password123");

                given(userRepository.findByUsername("newUser")).willReturn(Optional.empty());
                given(passwordEncoder.encode("password123")).willReturn("encodedPassword");
                given(userRepository.save(any(AppUser.class))).willAnswer(invocation -> {
                        AppUser savedUser = invocation.getArgument(0);
                        savedUser.setId(1L);
                        return savedUser;
                });

                mockMvc.perform(post("/api/users/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id", is(1)))
                                .andExpect(jsonPath("$.username", is("newUser")))
                                // Verify sensitive data is NOT exposed
                                .andExpect(jsonPath("$.password").doesNotExist())
                                .andExpect(jsonPath("$.salt").doesNotExist())
                                .andExpect(jsonPath("$.discogsToken").doesNotExist());
        }

        @Test
        void login_ShouldReturnUser_WhenCredentialsMatch_WithoutSensitiveData() throws Exception {
                Map<String, String> payload = Map.of("username", "user1", "password", "password123");
                AppUser user = new AppUser("user1", "encodedPassword", "salt");
                user.setId(1L);

                given(userRepository.findByUsername("user1")).willReturn(Optional.of(user));
                given(passwordEncoder.matches("password123", "encodedPassword")).willReturn(true);

                mockMvc.perform(post("/api/users/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.username", is("user1")))
                                // Verify sensitive data is NOT exposed
                                .andExpect(jsonPath("$.password").doesNotExist())
                                .andExpect(jsonPath("$.salt").doesNotExist())
                                .andExpect(jsonPath("$.discogsToken").doesNotExist());
        }

        @Test
        void updateDiscogs_ShouldUpdateSettings_WithoutExposingSensitiveData() throws Exception {
                Map<String, String> payload = Map.of(
                                "password", "password123",
                                "token", "newToken",
                                "discogsUsername", "discogsUser");
                AppUser user = new AppUser("user1", "encodedPassword", "salt");
                user.setId(1L);

                given(userRepository.findByUsername("user1")).willReturn(Optional.of(user));
                given(passwordEncoder.matches("password123", "encodedPassword")).willReturn(true);
                given(tokenService.encrypt("newToken")).willReturn("encryptedToken");
                given(userRepository.save(any(AppUser.class))).willAnswer(invocation -> invocation.getArgument(0));

                mockMvc.perform(put("/api/users/user1/discogs")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.discogsUsername", is("discogsUser")))
                                // Verify sensitive data is NOT exposed
                                .andExpect(jsonPath("$.password").doesNotExist())
                                .andExpect(jsonPath("$.salt").doesNotExist())
                                .andExpect(jsonPath("$.discogsToken").doesNotExist());
        }

        @Test
        void updateDiscogs_ShouldReturnUnauthorized_WhenPasswordMismatch() throws Exception {
                Map<String, String> payload = Map.of(
                                "password", "wrongPassword",
                                "token", "newToken",
                                "discogsUsername", "discogsUser");
                AppUser user = new AppUser("user1", "encodedPassword", "salt");

                given(userRepository.findByUsername("user1")).willReturn(Optional.of(user));
                given(passwordEncoder.matches("wrongPassword", "encodedPassword")).willReturn(false);

                mockMvc.perform(put("/api/users/user1/discogs")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isUnauthorized());
        }

        @Test
        void register_ShouldReturnBadRequest_WhenUsernameExists() throws Exception {
                Map<String, String> payload = Map.of("username", "existingUser", "password", "password123");
                given(userRepository.findByUsername("existingUser")).willReturn(Optional.of(new AppUser()));

                mockMvc.perform(post("/api/users/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void login_ShouldReturnUnauthorized_WhenPasswordMismatch() throws Exception {
                Map<String, String> payload = Map.of("username", "user1", "password", "wrongPassword");
                AppUser user = new AppUser("user1", "encodedPassword", "salt");
                given(userRepository.findByUsername("user1")).willReturn(Optional.of(user));
                given(passwordEncoder.matches("wrongPassword", "encodedPassword")).willReturn(false);

                mockMvc.perform(post("/api/users/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isUnauthorized());
        }

        @Test
        void resetPassword_ShouldUpdatePassword_WithoutExposingSensitiveData() throws Exception {
                Map<String, String> payload = Map.of(
                                "username", "user1",
                                "newPassword", "newPass",
                                "discogsToken", "newToken");
                AppUser user = new AppUser("user1", "oldPass", "oldSalt");

                given(userRepository.findByUsername("user1")).willReturn(Optional.of(user));
                given(passwordEncoder.encode("newPass")).willReturn("newEncodedPass");
                given(tokenService.encrypt("newToken")).willReturn("newEncryptedToken");
                given(userRepository.save(any(AppUser.class))).willAnswer(invocation -> invocation.getArgument(0));

                mockMvc.perform(post("/api/users/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.username", is("user1")))
                                // Verify sensitive data is NOT exposed
                                .andExpect(jsonPath("$.password").doesNotExist())
                                .andExpect(jsonPath("$.salt").doesNotExist())
                                .andExpect(jsonPath("$.discogsToken").doesNotExist());
        }
}
