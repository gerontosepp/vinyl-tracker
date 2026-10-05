package com.antigravity.vinyltracker.config;

import com.antigravity.vinyltracker.logging.RequestLoggingInterceptor;
import com.antigravity.vinyltracker.security.AuthRateLimitingInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@lombok.RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final RequestLoggingInterceptor requestLoggingInterceptor;
    private final AuthRateLimitingInterceptor authRateLimitingInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(requestLoggingInterceptor)
                .addPathPatterns("/api/**");

        registry.addInterceptor(authRateLimitingInterceptor)
                .addPathPatterns(
                        "/api/users/login",
                        "/api/users/register",
                        "/api/users/reset-password"
                );
    }
}
