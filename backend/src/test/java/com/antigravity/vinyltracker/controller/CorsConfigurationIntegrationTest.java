package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@TestPropertySource(properties = {
        "cors.allowed-origins=https://allowed.example",
        "cors.allow-credentials=false"
})
class CorsConfigurationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void preflightRequest_ShouldReturnCorsHeaders_ForAllowedOrigin() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Origin", "https://allowed.example");
        headers.set("Access-Control-Request-Method", "GET");

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/proxy/image?url=https://i.discogs.com/test.jpg",
                HttpMethod.OPTIONS,
                new HttpEntity<>(headers),
                Void.class
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        assertEquals("https://allowed.example", response.getHeaders().getAccessControlAllowOrigin());
    }

    @Test
    void preflightRequest_ShouldRejectDisallowedOrigin() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Origin", "https://blocked.example");
        headers.set("Access-Control-Request-Method", "GET");

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/proxy/image?url=https://i.discogs.com/test.jpg",
                HttpMethod.OPTIONS,
                new HttpEntity<>(headers),
                Void.class
        );

        HttpStatusCode status = response.getStatusCode();
        assertTrue(status.is4xxClientError() || status.is2xxSuccessful());
        assertNull(response.getHeaders().getAccessControlAllowOrigin());
        assertFalse(response.getHeaders().containsKey("Access-Control-Allow-Origin"));
    }
}