package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.security.crypto.keygen.KeyGenerators;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppUserController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.antigravity.vinyltracker.service.TokenEncryptionService tokenService;

    public AppUserController(AppUserRepository userRepository, PasswordEncoder passwordEncoder,
            com.antigravity.vinyltracker.service.TokenEncryptionService tokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    @PostMapping("/register")
    public ResponseEntity<AppUser> register(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().build();
        }

        String salt = KeyGenerators.string().generateKey();
        String hashedPassword = passwordEncoder.encode(password);

        AppUser newUser = new AppUser(username, hashedPassword, salt);
        return ResponseEntity.ok(userRepository.save(newUser));
    }

    @PostMapping("/login")
    public ResponseEntity<AppUser> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .map(user -> {
                    return ResponseEntity.ok(user);
                })
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/{username}/discogs")
    public ResponseEntity<AppUser> updateDiscogs(@PathVariable String username,
            @RequestBody Map<String, String> payload) {
        String password = payload.get("password"); // Password still required for AUTHENTICATION
        String token = payload.get("token");
        String discogsUsername = payload.get("discogsUsername");

        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword())) // Verify password first
                .map(user -> {
                    // Use system key for encryption, not user password
                    user.setDiscogsToken(tokenService.encrypt(token));
                    user.setDiscogsUsername(discogsUsername);
                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    // Helper endpoint to check if token is valid/decryptable (for
    // testing/debugging)
    @PostMapping("/{username}/decrypt-token")
    public ResponseEntity<String> decryptToken(@PathVariable String username,
            @RequestBody Map<String, String> payload) {
        String password = payload.get("password");
        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .map(user -> {
                    try {
                        return ResponseEntity.ok(tokenService.decrypt(user.getDiscogsToken()));
                    } catch (Exception e) {
                        return ResponseEntity.internalServerError().body("Decryption failed");
                    }
                })
                .orElse(ResponseEntity.status(401).build());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<AppUser> resetPassword(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String newPassword = payload.get("newPassword");
        // We still accept the token if the user provides it (frontend behavior), but
        // it's not strictly necessary for re-encryption anymore
        // However, since we are changing the key, we should re-save it if provided.
        String discogsToken = payload.get("discogsToken");

        return userRepository.findByUsername(username)
                .map(user -> {
                    String newSalt = KeyGenerators.string().generateKey();
                    String hashedPassword = passwordEncoder.encode(newPassword);

                    user.setPassword(hashedPassword);
                    user.setSalt(newSalt);

                    if (discogsToken != null && !discogsToken.isEmpty()) {
                        user.setDiscogsToken(tokenService.encrypt(discogsToken));
                    }
                    // If token is not provided, we keep the existing one (which is now encrypted
                    // with system key, so it remains valid!)

                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
