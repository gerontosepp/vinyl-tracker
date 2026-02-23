package com.antigravity.vinyltracker.logging;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.time.Instant;

@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(RequestLoggingInterceptor.class);

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("startTime", Instant.now());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
            Exception ex) {
        Instant startTime = (Instant) request.getAttribute("startTime");
        long duration = startTime != null ? Duration.between(startTime, Instant.now()).toMillis() : 0;

        String method = request.getMethod();
        String uri = request.getRequestURI();
        int status = response.getStatus();

        if (status >= 400 || ex != null) {
            String errorMessage = ex != null ? ex.getMessage() : "HTTP Error " + status;
            logger.error("API Error: {} {} - Status: {} - Time: {}ms - Error: {}",
                    method, uri, status, duration, errorMessage, ex);
        } else {
            logger.info("API Request: {} {} - Status: {} - Time: {}ms",
                    method, uri, status, duration);
        }
    }
}
