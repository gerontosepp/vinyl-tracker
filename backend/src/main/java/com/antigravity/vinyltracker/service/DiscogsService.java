package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpHeaders;

@Service
@lombok.extern.slf4j.Slf4j
public class DiscogsService {

    private final RestClient restClient;
    private final TokenEncryptionService tokenService;
    private static final String BASE_URL = "https://api.discogs.com";

    public DiscogsService(RestClient.Builder restClientBuilder, TokenEncryptionService tokenService) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
        this.tokenService = tokenService;
    }

    public DiscogsDto.Release getRelease(Long releaseId, AppUser user) {
        log.info("Fetching release details for ID: {}", releaseId);
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        return restClient.get()
                .uri("/releases/{id}", releaseId)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.Release.class);
    }

    public DiscogsDto.Release searchCollectionByBarcode(String barcode, AppUser user) {
        log.info("Searching Discogs for barcode: {}", barcode);
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        // 1. Search Global DB
        DiscogsDto.SearchResponse searchResponse = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/database/search")
                        .queryParam("barcode", barcode)
                        .queryParam("type", "release")
                        .build())
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.SearchResponse.class);

        if (searchResponse == null || searchResponse.getResults() == null) {
            log.warn("No results found on Discogs for barcode: {}", barcode);
            return null;
        }

        log.info("Found {} results for barcode {}", searchResponse.getResults().size(), barcode);

        // 2. Filter by Collection Ownership
        for (DiscogsDto.SearchResult result : searchResponse.getResults()) {
            log.info("Checking if release {} ({}) is in collection...", result.getId(), result.getTitle());
            if (isReleaseInCollection(result.getId(), user)) { // This calls another method using user, but we should
                                                               // pass decrypted token or decrypt inside
                log.info("Release matches and is in collection!");
                return getRelease(result.getId(), user);
            }
        }
        log.warn("Barcode found in Discogs, but no matching release in user's collection.");
        return null;
    }

    public boolean isReleaseInCollection(Long releaseId, AppUser user) {
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null)
            return false;

        try {
            restClient.get()
                    .uri("/users/{username}/collection/releases/{releaseId}", user.getDiscogsUsername(), releaseId)
                    .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                    .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            // log.debug("Release {} not in collection: {}", releaseId, e.getMessage());
            return false;
        }
    }

    public DiscogsDto.CollectionResponse getCollection(AppUser user, int page) {
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        return restClient.get()
                .uri("/users/{username}/collection/folders/0/releases?page={page}&per_page=100",
                        user.getDiscogsUsername(), page)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.CollectionResponse.class);
    }
}
