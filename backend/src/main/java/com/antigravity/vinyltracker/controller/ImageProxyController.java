package com.antigravity.vinyltracker.controller;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/proxy")
public class ImageProxyController {

    private final RestTemplate restTemplate;

    public ImageProxyController() {
        this.restTemplate = new RestTemplate();
    }

    @GetMapping("/image")
    public ResponseEntity<byte[]> proxyImage(@RequestParam("url") String url) {
        if (url == null || !url.startsWith("http")) {
            return ResponseEntity.badRequest().build();
        }

        try {
            HttpHeaders requestHeaders = new HttpHeaders();
            requestHeaders.set("User-Agent", "VinylTracker/1.0 +https://github.com/gerontosepp-dev/AntiGrafity");
            HttpEntity<String> entity = new HttpEntity<>(requestHeaders);

            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, entity, byte[].class);

            HttpHeaders headers = new HttpHeaders();

            // Forward the content type if available, fallback to jpeg
            MediaType contentType = response.getHeaders().getContentType();
            if (contentType != null) {
                headers.setContentType(contentType);
            } else {
                headers.setContentType(MediaType.IMAGE_JPEG);
            }

            // Cache control for performance
            headers.setCacheControl("public, max-age=86400"); // Cache for 24 hours

            return new ResponseEntity<>(response.getBody(), headers, HttpStatus.OK);

        } catch (RestClientException e) {
            System.err.println("Proxy Request Failed for: " + url + " - " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }
}
