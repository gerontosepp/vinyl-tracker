package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.exception.GlobalExceptionHandler;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.service.AppUserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AppUserControllerTest {

        private MockMvc mockMvc;

        @Mock
        private AppUserService appUserService;

        @Mock
        private AuthCookieService authCookieService;

        @InjectMocks
        private AppUserController userController;

        private ObjectMapper objectMapper = new ObjectMapper();

        @BeforeEach
        void setUp() {
                LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
                validator.afterPropertiesSet();
                mockMvc = MockMvcBuilders.standaloneSetup(userController)
                                .setControllerAdvice(new GlobalExceptionHandler())
                                .setValidator(validator)
                                .build();
        }

        @Test
        void register_ShouldReturnSavedUser_WithoutSensitiveData() throws Exception {
                Map<String, String> payload = Map.of("username", "newUser", "password", "password123");

                UserResponseDto dto = new UserResponseDto();
                dto.setId(1L);
                dto.setUsername("newUser");
                dto.setToken("dummy-jwt-token");
                given(appUserService.register(any())).willReturn(Optional.of(dto));
                given(authCookieService.createAuthCookie(eq("dummy-jwt-token")))
                                .willReturn(ResponseCookie.from("vinyl_token", "dummy-jwt-token").build());

                mockMvc.perform(post("/api/users/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("vinyl_token=")))
                                .andExpect(jsonPath("$.id", is(1)))
                                .andExpect(jsonPath("$.username", is("newUser")))
                                .andExpect(jsonPath("$.token").doesNotExist())
                                .andExpect(jsonPath("$.password").doesNotExist())
                                .andExpect(jsonPath("$.salt").doesNotExist());
        }

        @Test
        void login_ShouldReturnUser_WhenCredentialsMatch_WithoutSensitiveData() throws Exception {
                Map<String, String> payload = Map.of("username", "user1", "password", "password123");

                UserResponseDto dto = new UserResponseDto();
                dto.setId(1L);
                dto.setUsername("user1");
                dto.setToken("dummy-jwt-token");
                given(appUserService.login(any())).willReturn(Optional.of(dto));
                given(authCookieService.createAuthCookie(eq("dummy-jwt-token")))
                                .willReturn(ResponseCookie.from("vinyl_token", "dummy-jwt-token").build());

                mockMvc.perform(post("/api/users/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("vinyl_token=")))
                                .andExpect(jsonPath("$.username", is("user1")))
                                .andExpect(jsonPath("$.token").doesNotExist())
                                .andExpect(jsonPath("$.password").doesNotExist());
        }

        @Test
        void updateDiscogs_ShouldUpdateSettings_WithoutExposingSensitiveData() throws Exception {
                Map<String, String> payload = Map.of(
                                "password", "password123",
                                "token", "newToken",
                                "discogsUsername", "discogsUser");

                UserResponseDto dto = new UserResponseDto();
                dto.setId(1L);
                dto.setUsername("user1");
                dto.setDiscogsUsername("discogsUser");
                given(appUserService.updateDiscogs(eq("user1"), any())).willReturn(Optional.of(dto));

                Principal mockPrincipal = () -> "user1";

                mockMvc.perform(put("/api/users/me/discogs")
                                .principal(mockPrincipal)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.discogsUsername", is("discogsUser")));
        }

        @Test
        void register_ShouldReturnBadRequest_WhenUsernameExists() throws Exception {
                Map<String, String> payload = Map.of("username", "existingUser", "password", "password123");
                given(appUserService.register(any())).willReturn(Optional.empty());

                mockMvc.perform(post("/api/users/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void login_ShouldReturnUnauthorized_WhenPasswordMismatch() throws Exception {
                Map<String, String> payload = Map.of("username", "user1", "password", "wrongPassword");
                given(appUserService.login(any())).willReturn(Optional.empty());

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

                UserResponseDto dto = new UserResponseDto();
                dto.setId(1L);
                dto.setUsername("user1");
                dto.setToken("dummy-jwt-token");
                given(appUserService.resetPassword(any())).willReturn(Optional.of(dto));
                given(authCookieService.createAuthCookie(eq("dummy-jwt-token")))
                                .willReturn(ResponseCookie.from("vinyl_token", "dummy-jwt-token").build());

                mockMvc.perform(post("/api/users/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(payload)))
                                .andExpect(status().isOk())
                                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("vinyl_token=")))
                                .andExpect(jsonPath("$.username", is("user1")))
                                .andExpect(jsonPath("$.token").doesNotExist());
        }

        @Test
        void logout_ShouldClearAuthCookie() throws Exception {
                given(authCookieService.createClearingCookie())
                                .willReturn(ResponseCookie.from("vinyl_token", "").maxAge(0).build());

                mockMvc.perform(post("/api/users/logout"))
                                .andExpect(status().isNoContent())
                                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("vinyl_token=")));
        }

        @Test
        void register_ShouldReturnBadRequest_WhenPayloadInvalid() throws Exception {
                Map<String, String> invalidPayload = Map.of("username", "", "password", "");

                mockMvc.perform(post("/api/users/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(invalidPayload)))
                                .andExpect(status().isBadRequest())
                                .andExpect(content().contentType("application/problem+json"))
                                .andExpect(jsonPath("$.title", is("Validation failed")))
                                .andExpect(jsonPath("$.status", is(400)));

                verifyNoInteractions(appUserService);
        }
}
