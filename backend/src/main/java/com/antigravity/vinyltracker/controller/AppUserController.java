package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.crypto.keygen.KeyGenerators;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    public ResponseEntity<UserResponseDto> register(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().build();
        }

        String salt = KeyGenerators.string().generateKey();
        String hashedPassword = passwordEncoder.encode(password);

        AppUser newUser = new AppUser(username, hashedPassword, salt);
        AppUser savedUser = userRepository.save(newUser);
        return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser));
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .map(user -> ResponseEntity.ok(UserResponseDto.fromEntity(user)))
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/{username}/discogs")
    public ResponseEntity<UserResponseDto> updateDiscogs(@PathVariable String username,
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
                    AppUser savedUser = userRepository.save(user);
                    return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser));
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
    public ResponseEntity<UserResponseDto> resetPassword(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String newPassword = payload.get("newPassword");
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

                    AppUser savedUser = userRepository.save(user);
                    return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{username}")
    public ResponseEntity<UserResponseDto> getUser(@PathVariable String username) {
        return userRepository.findByUsername(username)
                .map(user -> ResponseEntity.ok(UserResponseDto.fromEntity(user)))
                .orElse(ResponseEntity.notFound().build());
    }
}
