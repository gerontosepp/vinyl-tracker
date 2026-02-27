package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.crypto.keygen.KeyGenerators;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.antigravity.vinyltracker.security.JwtService;
import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppUserController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.antigravity.vinyltracker.service.TokenEncryptionService tokenService;
    private final JwtService jwtService;

    public AppUserController(AppUserRepository userRepository, PasswordEncoder passwordEncoder,
            com.antigravity.vinyltracker.service.TokenEncryptionService tokenService, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.jwtService = jwtService;
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

        String token = jwtService.generateToken(savedUser.getUsername());
        return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser, token));
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .map(user -> {
                    String token = jwtService.generateToken(user.getUsername());
                    return ResponseEntity.ok(UserResponseDto.fromEntity(user, token));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/me/discogs")
    public ResponseEntity<UserResponseDto> updateDiscogs(Principal principal,
            @RequestBody Map<String, String> payload) {
        String token = payload.get("token");
        String discogsUsername = payload.get("discogsUsername");

        return userRepository.findByUsername(principal.getName())
                .map(user -> {
                    user.setDiscogsToken(tokenService.encrypt(token));
                    user.setDiscogsUsername(discogsUsername);
                    AppUser savedUser = userRepository.save(user);
                    return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser));
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
                    String systemToken = jwtService.generateToken(savedUser.getUsername());
                    return ResponseEntity.ok(UserResponseDto.fromEntity(savedUser, systemToken));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getUser(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(user -> ResponseEntity.ok(UserResponseDto.fromEntity(user)))
                .orElse(ResponseEntity.notFound().build());
    }
}
