package com.antigravity.vinyltracker.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageProxyUrlValidatorTest {

    private final ImageProxyUrlValidator validator = new ImageProxyUrlValidator(
            "8.8.8.8,i.discogs.com,api.discogs.com"
    );

    @Test
    void isAllowed_ShouldRejectNullAndBlankUrls() {
        assertFalse(validator.isAllowed(null));
        assertFalse(validator.isAllowed("   "));
    }

    @Test
    void isAllowed_ShouldRejectMalformedUrl() {
        assertFalse(validator.isAllowed("%%%"));
    }

    @Test
    void isAllowed_ShouldRejectNonHttpsScheme() {
        assertFalse(validator.isAllowed("http://i.discogs.com/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectDisallowedHost() {
        assertFalse(validator.isAllowed("https://example.com/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectLocalhost() {
        assertFalse(validator.isAllowed("https://localhost/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectPrivateAddress() {
        ImageProxyUrlValidator localOnlyValidator = new ImageProxyUrlValidator("127.0.0.1");
        assertFalse(localOnlyValidator.isAllowed("https://127.0.0.1/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectCustomPort() {
        assertFalse(validator.isAllowed("https://i.discogs.com:8443/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectUserInfoInUrl() {
        assertFalse(validator.isAllowed("https://user:pass@i.discogs.com/image.jpg"));
    }

    @Test
    void isAllowed_ShouldRejectUnknownHostInAllowlist() {
        ImageProxyUrlValidator unknownHostValidator = new ImageProxyUrlValidator("does-not-resolve.invalid");
        assertFalse(unknownHostValidator.isAllowed("https://does-not-resolve.invalid/image.jpg"));
    }

    @Test
    void isAllowed_ShouldAllowConfiguredPublicHost() {
        assertTrue(validator.isAllowed("https://8.8.8.8/image.jpg"));
    }

    @Test
    void isAllowed_ShouldAllowHttpsDefaultPortAnd443() {
        assertTrue(validator.isAllowed("https://8.8.8.8/image.jpg"));
        assertTrue(validator.isAllowed("https://8.8.8.8:443/image.jpg"));
    }
}