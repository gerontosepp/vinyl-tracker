package com.antigravity.vinyltracker.security;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthRateLimiterService {

    private final RateLimiterRegistry rateLimiterRegistry;

    @Value("${auth.rate-limit.limit-for-period:10}")
    private int defaultLimitForPeriod = 10;

    /**
     * Checks if a request from the given client identifier is permitted.
     * Throws RequestNotPermitted if the rate limit is exceeded.
     *
     * @param clientIdentifier IP address or unique client identifier
     * @throws RequestNotPermitted when rate limit is exceeded
     */
    public void acquirePermission(String clientIdentifier) {
        String key = (clientIdentifier != null && !clientIdentifier.isBlank())
                ? "auth:" + clientIdentifier.trim()
                : "auth:unknown";

        int limit = defaultLimitForPeriod > 0 ? defaultLimitForPeriod : 10;

        RateLimiter rateLimiter = rateLimiterRegistry.getConfiguration("auth")
                .map(config -> rateLimiterRegistry.rateLimiter(key, config))
                .orElseGet(() -> rateLimiterRegistry.find("auth")
                        .map(authLimiter -> rateLimiterRegistry.rateLimiter(key, authLimiter.getRateLimiterConfig()))
                        .orElseGet(() -> {
                            RateLimiterConfig fallback = RateLimiterConfig.custom()
                                    .limitForPeriod(limit)
                                    .limitRefreshPeriod(Duration.ofMinutes(1))
                                    .timeoutDuration(Duration.ZERO)
                                    .build();
                            return rateLimiterRegistry.rateLimiter(key, fallback);
                        }));

        RateLimiter.waitForPermission(rateLimiter);
    }
}
