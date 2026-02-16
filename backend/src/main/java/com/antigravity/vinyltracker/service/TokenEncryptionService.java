package com.antigravity.vinyltracker.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.stereotype.Service;

@Service
public class TokenEncryptionService {

    private final TextEncryptor encryptor;

    public TokenEncryptionService(
            @Value("${vinyl.encryption.password}") String password,
            @Value("${vinyl.encryption.salt}") String salt) {
        this.encryptor = Encryptors.text(password, salt);
    }

    public String encrypt(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }
        return encryptor.encrypt(text);
    }

    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return null;
        }
        try {
            return encryptor.decrypt(encryptedText);
        } catch (Exception e) {
            // Log decryption failure and return null potentially
            return null;
        }
    }
}
