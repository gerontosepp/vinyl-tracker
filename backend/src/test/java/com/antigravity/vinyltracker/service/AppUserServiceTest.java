package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AppUserServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TokenEncryptionService tokenService;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AppUserService appUserService;

    private AppUser testUser;

    @BeforeEach
    void setUp() {
        testUser = new AppUser("testuser", "encodedPsw", "saltsalt");
        testUser.setId(1L);
    }

    @Test
    void register_Success() {
        when(userRepository.findByUsername("newuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password")).thenReturn("encoded!@#");
        when(userRepository.save(any(AppUser.class))).thenAnswer(i -> {
            AppUser u = i.getArgument(0);
            u.setId(2L);
            return u;
        });
        when(jwtService.generateToken("newuser")).thenReturn("jwt-token-123");

        Optional<UserResponseDto> result = appUserService
                .register(Map.of("username", "newuser", "password", "password"));

        assertTrue(result.isPresent());
        assertEquals("newuser", result.get().getUsername());
        assertEquals("jwt-token-123", result.get().getToken());
    }

    @Test
    void register_UserExists() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        Optional<UserResponseDto> result = appUserService
                .register(Map.of("username", "testuser", "password", "password"));
        assertFalse(result.isPresent());
    }

    @Test
    void login_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("mypsw", "encodedPsw")).thenReturn(true);
        when(jwtService.generateToken("testuser")).thenReturn("jwt-token-abc");

        Optional<UserResponseDto> result = appUserService.login(Map.of("username", "testuser", "password", "mypsw"));

        assertTrue(result.isPresent());
        assertEquals("testuser", result.get().getUsername());
        assertEquals("jwt-token-abc", result.get().getToken());
    }

    @Test
    void login_InvalidPassword() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("wrongpsw", "encodedPsw")).thenReturn(false);

        Optional<UserResponseDto> result = appUserService.login(Map.of("username", "testuser", "password", "wrongpsw"));

        assertFalse(result.isPresent());
    }

    @Test
    void updateDiscogs_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(tokenService.encrypt("newToken")).thenReturn("encryptedToken");
        when(userRepository.save(any(AppUser.class))).thenReturn(testUser);

        Optional<UserResponseDto> result = appUserService.updateDiscogs("testuser",
                Map.of("token", "newToken", "discogsUsername", "testDiscname"));

        assertTrue(result.isPresent());
        assertEquals("testuser", result.get().getUsername());
        verify(userRepository).save(testUser);
        assertEquals("testDiscname", testUser.getDiscogsUsername());
        assertEquals("encryptedToken", testUser.getDiscogsToken());
    }

    @Test
    void resetPassword_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.encode("newpsw")).thenReturn("newEncoded");
        when(tokenService.encrypt("newDiscogs")).thenReturn("encDiscogs");
        when(userRepository.save(any(AppUser.class))).thenReturn(testUser);
        when(jwtService.generateToken("testuser")).thenReturn("new-jwt-token");

        Optional<UserResponseDto> result = appUserService.resetPassword(
                Map.of("username", "testuser", "newPassword", "newpsw", "discogsToken", "newDiscogs"));

        assertTrue(result.isPresent());
        assertEquals("new-jwt-token", result.get().getToken());
        assertEquals("newEncoded", testUser.getPassword());
        assertEquals("encDiscogs", testUser.getDiscogsToken());
    }

    @Test
    void getUser_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        Optional<UserResponseDto> result = appUserService.getUser("testuser");
        assertTrue(result.isPresent());
        assertEquals("testuser", result.get().getUsername());
    }
}
