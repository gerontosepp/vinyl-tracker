package com.antigravity.vinyltracker.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleDiscogsToken_ShouldReturn422() {
        DiscogsTokenException ex = new DiscogsTokenException("Token invalid");

        ResponseEntity<ProblemDetail> response = handler.handleDiscogsToken(ex);

        assertEquals(422, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("Discogs token error", response.getBody().getTitle());
        assertEquals("Token invalid", response.getBody().getDetail());
        assertNotNull(response.getBody().getProperties().get("timestamp"));
    }

    @Test
    void handleDiscogsApi_ShouldReturn502() {
        DiscogsApiException ex = new DiscogsApiException("API unreachable");

        ResponseEntity<ProblemDetail> response = handler.handleDiscogsApi(ex);

        assertEquals(HttpStatus.BAD_GATEWAY.value(), response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("Discogs API error", response.getBody().getTitle());
        assertEquals("API unreachable", response.getBody().getDetail());
    }

    @Test
    void handleCollectionSync_ShouldReturn500() {
        CollectionSyncException ex = new CollectionSyncException("Sync failed");

        ResponseEntity<ProblemDetail> response = handler.handleCollectionSync(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("Collection sync error", response.getBody().getTitle());
        assertEquals("Sync failed", response.getBody().getDetail());
    }

    @Test
    void handleDiscogsToken_ShouldUseFallbackMessage_WhenMessageIsNull() {
        DiscogsTokenException ex = new DiscogsTokenException(null);

        ResponseEntity<ProblemDetail> response = handler.handleDiscogsToken(ex);

        assertEquals(422, response.getStatusCode().value());
        assertEquals("Invalid or missing Discogs token.", response.getBody().getDetail());
    }

    @Test
    void handlePdfGeneration_ShouldReturn500() {
        PdfGenerationException ex = new PdfGenerationException("PDF compilation failed");

        ResponseEntity<ProblemDetail> response = handler.handlePdfGeneration(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("PDF generation error", response.getBody().getTitle());
        assertEquals("PDF compilation failed", response.getBody().getDetail());
        assertNotNull(response.getBody().getProperties().get("timestamp"));
    }

    @Test
    void handlePdfGeneration_ShouldUseFallbackMessage_WhenMessageIsNull() {
        PdfGenerationException ex = new PdfGenerationException(null);

        ResponseEntity<ProblemDetail> response = handler.handlePdfGeneration(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("PDF generation error", response.getBody().getTitle());
        assertEquals("Error generating PDF.", response.getBody().getDetail());
        assertNotNull(response.getBody().getProperties().get("timestamp"));
    }

    @Test
    void handleRuntime_ShouldReturn500() {
        RuntimeException ex = new RuntimeException("Unexpected error");

        ResponseEntity<ProblemDetail> response = handler.handleRuntime(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), response.getStatusCode().value());
        assertEquals("Internal server error", response.getBody().getTitle());
        assertEquals("Unexpected error", response.getBody().getDetail());
    }
}
