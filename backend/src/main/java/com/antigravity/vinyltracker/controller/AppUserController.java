package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.service.AppUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppUserController {

    private final AppUserService appUserService;
    private final AuthCookieService authCookieService;

    public AppUserController(AppUserService appUserService, AuthCookieService authCookieService) {
        this.appUserService = appUserService;
        this.authCookieService = authCookieService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@RequestBody Map<String, String> payload) {
        return appUserService.register(payload)
                .map(this::withAuthCookie)
                .orElse(ResponseEntity.badRequest().build());
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> login(@RequestBody Map<String, String> payload) {
        return appUserService.login(payload)
                .map(this::withAuthCookie)
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/me/discogs")
    public ResponseEntity<UserResponseDto> updateDiscogs(Principal principal,
            @RequestBody Map<String, String> payload) {
        return appUserService.updateDiscogs(principal.getName(), payload)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(401).build());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<UserResponseDto> resetPassword(@RequestBody Map<String, String> payload) {
        return appUserService.resetPassword(payload)
                .map(this::withAuthCookie)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header("Set-Cookie", authCookieService.createClearingCookie().toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getUser(Principal principal) {
        return appUserService.getUser(principal.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private ResponseEntity<UserResponseDto> withAuthCookie(UserResponseDto dto) {
        String token = dto.getToken();
        if (token == null || token.isBlank()) {
            return ResponseEntity.status(500).build();
        }

        UserResponseDto safeDto = new UserResponseDto();
        safeDto.setId(dto.getId());
        safeDto.setUsername(dto.getUsername());
        safeDto.setDiscogsUsername(dto.getDiscogsUsername());

        return ResponseEntity.ok()
                .header("Set-Cookie", authCookieService.createAuthCookie(token).toString())
                .body(safeDto);
    }
}
