package com.antigravity.vinyltracker.service;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TokenEncryptionServiceTest {

    private TokenEncryptionService service;

    @BeforeEach
    void setUp() {
        // use valid hex string for salt if required by Encryptors.text()
        // verify what Encryptors.text uses. Often just strings.
        // The implementation uses TextEncryptor.
        service = new TokenEncryptionService("test-password", "12345678");
    }

    @Test
    void testEncryptDecrypt() {
        String original = "secret";
        String encrypted = service.encrypt(original);
        Assertions.assertNotNull(encrypted);
        Assertions.assertNotEquals(original, encrypted);
        Assertions.assertEquals(original, service.decrypt(encrypted));
    }

    @Test
    void testEncryptNullOrEmpty() {
        Assertions.assertNull(service.encrypt(null));
        Assertions.assertNull(service.encrypt(""));
    }

    @Test
    void testDecryptNullOrEmpty() {
        Assertions.assertNull(service.decrypt(null));
        Assertions.assertNull(service.decrypt(""));
    }

    @Test
    void testDecryptInvalid() {
        // Should return null on exception
        Assertions.assertNull(service.decrypt("invalid-garbage-data"));
    }
}
