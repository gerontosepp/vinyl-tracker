package com.antigravity.vinyltracker.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.util.Objects;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AuthCookieService {

    @Getter
    @Value("${auth.cookie.name:vinyl_token}")
    private final String cookieName;

    @Value("${auth.cookie.max-age-seconds:86400}")
    private final long maxAgeSeconds;

    @Value("${auth.cookie.secure:true}")
    private final boolean secure;

    @Value("${auth.cookie.same-site:Lax}")
    private final String sameSite;

    public ResponseCookie createAuthCookie(String token) {
        return ResponseCookie.from(Objects.requireNonNull(cookieName), Objects.requireNonNull(token))
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/")
                .maxAge(maxAgeSeconds)
                .build();
    }

    public ResponseCookie createClearingCookie() {
        return ResponseCookie.from(Objects.requireNonNull(cookieName), "")
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/")
                .maxAge(0)
                .build();
    }
}