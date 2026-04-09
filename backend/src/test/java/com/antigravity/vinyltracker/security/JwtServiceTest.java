package com.antigravity.vinyltracker.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    @Test
    void validateConfiguration_ShouldFail_WhenSecretMissing() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", "");

        IllegalStateException ex = assertThrows(IllegalStateException.class, jwtService::validateConfiguration);
        assertTrue(ex.getMessage().contains("JWT secret must be configured"));
    }

    @Test
    void validateConfiguration_ShouldFail_WhenSecretTooShort() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", "short-secret");

        IllegalStateException ex = assertThrows(IllegalStateException.class, jwtService::validateConfiguration);
        assertTrue(ex.getMessage().contains("at least 32 characters"));
    }

    @Test
    void generateToken_ShouldCreateParsableToken_WhenSecretIsValid() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", "test-secret-key-for-tests-1234567890");
        ReflectionTestUtils.setField(jwtService, "jwtExpiration", 60000L);
        jwtService.validateConfiguration();

        String token = jwtService.generateToken("alice");

        assertNotNull(token);
        assertEquals("alice", jwtService.extractUsername(token));
        assertTrue(jwtService.isTokenValid(token, "alice"));
    }
}