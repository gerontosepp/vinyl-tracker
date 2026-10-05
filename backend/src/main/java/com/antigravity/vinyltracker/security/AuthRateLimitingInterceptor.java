package com.antigravity.vinyltracker.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@Slf4j
public class AuthRateLimitingInterceptor implements HandlerInterceptor {

    private final AuthRateLimiterService authRateLimiterService;

    public AuthRateLimitingInterceptor(@Autowired(required = false) AuthRateLimiterService authRateLimiterService) {
        this.authRateLimiterService = authRateLimiterService;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request,
                             @NonNull HttpServletResponse response,
                             @NonNull Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || authRateLimiterService == null) {
            return true;
        }

        String clientIp = resolveClientIp(request);
        log.debug("Evaluating auth rate limit for IP: {} on URI: {}", clientIp, request.getRequestURI());
        authRateLimiterService.acquirePermission(clientIp);
        return true;
    }

    public static String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
