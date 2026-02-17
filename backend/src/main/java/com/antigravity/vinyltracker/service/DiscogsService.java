package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpHeaders;
import java.util.List;

@Service
@lombok.extern.slf4j.Slf4j
public class DiscogsService {

    private final RestClient restClient;
    private final TokenEncryptionService tokenService;
    private final com.antigravity.vinyltracker.repository.ListenEventRepository listenEventRepository;
    private static final String BASE_URL = "https://api.discogs.com";

    public DiscogsService(RestClient.Builder restClientBuilder, TokenEncryptionService tokenService,
            com.antigravity.vinyltracker.repository.ListenEventRepository listenEventRepository) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
        this.tokenService = tokenService;
        this.listenEventRepository = listenEventRepository;
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

    public DiscogsDto.CollectionResponse getCollection(AppUser user, int page, int perPage, String sort,
            String sortOrder) {
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        DiscogsDto.CollectionResponse response = restClient.get()
                .uri("/users/{username}/collection/folders/0/releases?page={page}&per_page={perPage}&sort={sort}&sort_order={sortOrder}",
                        user.getDiscogsUsername(), page, perPage, sort, sortOrder)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.CollectionResponse.class);

        if (response != null && response.getReleases() != null) {
            List<Object[]> listenCounts = listenEventRepository.countListensByUserId(user.getId());
            java.util.Map<Long, Long> countsMap = listenCounts.stream()
                    .collect(java.util.stream.Collectors.toMap(
                            row -> (Long) row[0],
                            row -> (Long) row[1]));

            response.getReleases().forEach(release -> {
                release.setListenCount(countsMap.getOrDefault(release.getId(), 0L));
            });
        }

        return response;
    }

    public List<DiscogsDto.CollectionRelease> getAllCollection(AppUser user) {
        List<DiscogsDto.CollectionRelease> allReleases = new java.util.ArrayList<>();
        int page = 1;
        int perPage = 100; // Max allowed by Discogs
        int totalPages = 1;

        // Pre-fetch listen counts for all releases to avoid N+1 if we were doing it
        // per-page loops,
        // but since we are reusing getCollection, it does the query every time.
        // For getAllCollection which might make multiple requests, it is inefficient to
        // query DB every time,
        // but for now it ensures consistency.
        // Optimization: Query once outside loop and set?
        // But getCollection returns DTOs with listenCounts already set.
        // So we just aggregate them.

        do {
            DiscogsDto.CollectionResponse response = getCollection(user, page, perPage, "artist", "asc");
            if (response != null && response.getReleases() != null) {
                allReleases.addAll(response.getReleases());
                if (response.getPagination() != null) {
                    totalPages = response.getPagination().getPages();
                }
            } else {
                break;
            }
            page++;
        } while (page <= totalPages);

        return allReleases;
    }
}
