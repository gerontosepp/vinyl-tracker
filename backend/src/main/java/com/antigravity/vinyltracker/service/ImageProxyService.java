package com.antigravity.vinyltracker.service;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

@Service
public class ImageProxyService {

    private final RestTemplate restTemplate;

    public ImageProxyService() {
        this.restTemplate = new RestTemplate();
    }

    public Optional<ResponseEntity<byte[]>> proxyImage(String url) {
        try {
            HttpHeaders requestHeaders = new HttpHeaders();
            requestHeaders.set("User-Agent", "VinylTracker/1.0 +https://github.com/gerontosepp/vinyl-tracker");
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

            return Optional
                    .of(new ResponseEntity<>(response.getBody(), headers, org.springframework.http.HttpStatus.OK));

        } catch (RestClientException e) {
            System.err.println("Proxy Request Failed for: " + url + " - " + e.getMessage());
            return Optional.empty();
        }
    }
}
