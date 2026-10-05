package com.antigravity.vinyltracker.security;

import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimiterServiceTest {

    private RateLimiterRegistry rateLimiterRegistry;
    private AuthRateLimiterService authRateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterRegistry = RateLimiterRegistry.ofDefaults();
        RateLimiterConfig authConfig = RateLimiterConfig.custom()
                .limitForPeriod(3)
                .limitRefreshPeriod(Duration.ofMinutes(1))
                .timeoutDuration(Duration.ZERO)
                .build();
        rateLimiterRegistry.addConfiguration("auth", authConfig);

        authRateLimiterService = new AuthRateLimiterService(rateLimiterRegistry);
    }

    @Test
    void acquirePermission_ShouldAllowRequests_WithinLimit() {
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.100"));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.100"));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.100"));
    }

    @Test
    void acquirePermission_ShouldThrowRequestNotPermitted_WhenLimitExceeded() {
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.101"));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.101"));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("192.168.1.101"));

        assertThrows(RequestNotPermitted.class, () -> authRateLimiterService.acquirePermission("192.168.1.101"));
    }

    @Test
    void acquirePermission_ShouldIsolateDifferentIps() {
        String ip1 = "10.0.0.1";
        String ip2 = "10.0.0.2";

        // Exhaust IP 1
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(ip1));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(ip1));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(ip1));
        assertThrows(RequestNotPermitted.class, () -> authRateLimiterService.acquirePermission(ip1));

        // IP 2 should still have permits
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(ip2));
    }

    @Test
    void acquirePermission_ShouldHandleNullAndBlankIps() {
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(null));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission("   "));
        assertDoesNotThrow(() -> authRateLimiterService.acquirePermission(""));
        assertThrows(RequestNotPermitted.class, () -> authRateLimiterService.acquirePermission(null));
    }

    @Test
    void acquirePermission_ShouldUseFallbackConfig_WhenAuthConfigMissing() {
        RateLimiterRegistry emptyRegistry = RateLimiterRegistry.ofDefaults();
        AuthRateLimiterService serviceWithFallback = new AuthRateLimiterService(emptyRegistry);

        assertDoesNotThrow(() -> serviceWithFallback.acquirePermission("127.0.0.1"));
    }
}
