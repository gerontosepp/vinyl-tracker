package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.security.crypto.keygen.KeyGenerators;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.antigravity.vinyltracker.security.JwtService;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class AppUserService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenEncryptionService tokenService;
    private final JwtService jwtService;

    public AppUserService(AppUserRepository userRepository, PasswordEncoder passwordEncoder,
            TokenEncryptionService tokenService, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.jwtService = jwtService;
    }

    public Optional<UserResponseDto> register(Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        if (userRepository.findByUsername(username).isPresent()) {
            return Optional.empty();
        }

        String salt = KeyGenerators.string().generateKey();
        String hashedPassword = passwordEncoder.encode(password);

        AppUser newUser = new AppUser(username, hashedPassword, salt);
        AppUser savedUser = userRepository.save(newUser);

        String token = jwtService.generateToken(savedUser.getUsername());
        return Optional.of(UserResponseDto.fromEntity(savedUser, token));
    }

    public Optional<UserResponseDto> login(Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .map(user -> {
                    String token = jwtService.generateToken(user.getUsername());
                    return UserResponseDto.fromEntity(user, token);
                });
    }

    public Optional<UserResponseDto> updateDiscogs(String username, Map<String, String> payload) {
        String token = payload.get("token");
        String discogsUsername = payload.get("discogsUsername");

        return userRepository.findByUsername(username)
                .map(user -> {
                    user.setDiscogsToken(tokenService.encrypt(token));
                    user.setDiscogsUsername(discogsUsername);
                    AppUser savedUser = userRepository.save(user);

                    return UserResponseDto.fromEntity(savedUser);
                });
    }

    public Optional<UserResponseDto> resetPassword(Map<String, String> payload) {
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
                    return UserResponseDto.fromEntity(savedUser, systemToken);
                });
    }

    public Optional<UserResponseDto> getUser(String username) {
        return userRepository.findByUsername(username)
                .map(UserResponseDto::fromEntity);
    }
}
