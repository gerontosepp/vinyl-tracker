package com.antigravity.vinyltracker.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class AuthCookieService {

    private final String cookieName;
    private final long maxAgeSeconds;
    private final boolean secure;
    private final String sameSite;

    public AuthCookieService(
            @Value("${auth.cookie.name:vinyl_token}") String cookieName,
            @Value("${auth.cookie.max-age-seconds:86400}") long maxAgeSeconds,
            @Value("${auth.cookie.secure:true}") boolean secure,
            @Value("${auth.cookie.same-site:Lax}") String sameSite
    ) {
        this.cookieName = cookieName;
        this.maxAgeSeconds = maxAgeSeconds;
        this.secure = secure;
        this.sameSite = sameSite;
    }

    public String getCookieName() {
        return cookieName;
    }

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