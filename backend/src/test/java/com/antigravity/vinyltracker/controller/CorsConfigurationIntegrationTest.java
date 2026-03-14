package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@TestPropertySource(properties = {
        "cors.allowed-origins=https://allowed.example",
        "cors.allow-credentials=false"
})
class CorsConfigurationIntegrationTest extends AbstractIntegrationTest {

    private static final ExecutorService HTTP_EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "cors-test-http-client");
        thread.setDaemon(true);
        return thread;
    });

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .executor(HTTP_EXECUTOR)
            .build();

    @LocalServerPort
    private int port;

    private HttpResponse<Void> sendPreflight(String origin) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/proxy/image?url=https://i.discogs.com/test.jpg"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", origin)
                .header("Access-Control-Request-Method", "GET")
                .build();

        return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.discarding());
    }

    @AfterAll
    static void shutdownHttpExecutor() {
        HTTP_EXECUTOR.shutdownNow();
    }

    @Test
    void preflightRequest_ShouldReturnCorsHeaders_ForAllowedOrigin() throws IOException, InterruptedException {
        HttpResponse<Void> response = sendPreflight("https://allowed.example");

        assertTrue(response.statusCode() >= 200 && response.statusCode() < 300);
        assertEquals("https://allowed.example", response.headers().firstValue("Access-Control-Allow-Origin").orElse(null));
    }

    @Test
    void preflightRequest_ShouldRejectDisallowedOrigin() throws IOException, InterruptedException {
        HttpResponse<Void> response = sendPreflight("https://blocked.example");

        assertTrue((response.statusCode() >= 400 && response.statusCode() < 500)
                || (response.statusCode() >= 200 && response.statusCode() < 300));
        assertNull(response.headers().firstValue("Access-Control-Allow-Origin").orElse(null));
    }
}