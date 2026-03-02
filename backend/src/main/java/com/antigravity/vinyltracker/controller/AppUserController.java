package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.service.AppUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppUserController {

    private final AppUserService appUserService;

    public AppUserController(AppUserService appUserService) {
        this.appUserService = appUserService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@RequestBody Map<String, String> payload) {
        return appUserService.register(payload)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().build());
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> login(@RequestBody Map<String, String> payload) {
        return appUserService.login(payload)
                .map(ResponseEntity::ok)
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
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getUser(Principal principal) {
        return appUserService.getUser(principal.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
