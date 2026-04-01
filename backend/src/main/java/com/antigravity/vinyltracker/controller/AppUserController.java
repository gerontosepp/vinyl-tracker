package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.LoginRequestDto;
import com.antigravity.vinyltracker.model.dto.RegisterRequestDto;
import com.antigravity.vinyltracker.model.dto.ResetPasswordRequestDto;
import com.antigravity.vinyltracker.model.dto.UpdateDiscogsRequestDto;
import com.antigravity.vinyltracker.model.dto.UserResponseDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.service.AppUserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/users")
@lombok.RequiredArgsConstructor
public class AppUserController {

    private final AppUserService appUserService;
    private final AuthCookieService authCookieService;

    @PostMapping("/register")
        public ResponseEntity<UserResponseDto> register(@Valid @RequestBody RegisterRequestDto payload) {
        return appUserService.register(payload)
                .map(this::withAuthCookie)
                .orElse(ResponseEntity.badRequest().build());
    }

    @PostMapping("/login")
        public ResponseEntity<UserResponseDto> login(@Valid @RequestBody LoginRequestDto payload) {
        return appUserService.login(payload)
                .map(this::withAuthCookie)
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/me/discogs")
    public ResponseEntity<UserResponseDto> updateDiscogs(Principal principal,
            @Valid @RequestBody UpdateDiscogsRequestDto payload) {
        return appUserService.updateDiscogs(principal.getName(), payload)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(401).build());
    }

    @PostMapping("/reset-password")
        public ResponseEntity<UserResponseDto> resetPassword(@Valid @RequestBody ResetPasswordRequestDto payload) {
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
