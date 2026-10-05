package com.antigravity.vinyltracker.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthRateLimitingInterceptorTest {

    @Mock
    private AuthRateLimiterService authRateLimiterService;

    private AuthRateLimitingInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new AuthRateLimitingInterceptor(authRateLimiterService);
    }

    @Test
    void preHandle_ShouldAllowPostRequest_AndAcquirePermission() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/users/login");
        request.setRemoteAddr("192.168.1.50");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        verify(authRateLimiterService, times(1)).acquirePermission("192.168.1.50");
    }

    @Test
    void preHandle_ShouldSkipRateLimiting_ForOptionsRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/users/login");
        request.setRemoteAddr("192.168.1.50");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        verifyNoInteractions(authRateLimiterService);
    }

    @Test
    void resolveClientIp_ShouldPrioritizeXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18, 150.172.238.178");
        request.addHeader("X-Real-IP", "10.0.0.1");
        request.setRemoteAddr("127.0.0.1");

        String ip = AuthRateLimitingInterceptor.resolveClientIp(request);
        assertEquals("203.0.113.195", ip);
    }

    @Test
    void resolveClientIp_ShouldUseXRealIp_WhenXForwardedForMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "198.51.100.4");
        request.setRemoteAddr("127.0.0.1");

        String ip = AuthRateLimitingInterceptor.resolveClientIp(request);
        assertEquals("198.51.100.4", ip);
    }

    @Test
    void resolveClientIp_ShouldFallbackToRemoteAddr_WhenHeadersMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.1");

        String ip = AuthRateLimitingInterceptor.resolveClientIp(request);
        assertEquals("192.0.2.1", ip);
    }
}
