package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpHeaders;

@Service
public class DiscogsService {

    private final RestClient restClient;
    private static final String BASE_URL = "https://api.discogs.com";

    public DiscogsService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
    }

    public DiscogsDto.Release getRelease(Long releaseId, AppUser user) {
        return restClient.get()
                .uri("/releases/{id}", releaseId)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + user.getDiscogsToken())
                .retrieve()
                .body(DiscogsDto.Release.class);
    }

    public DiscogsDto.Release searchCollectionByBarcode(String barcode, AppUser user) {
        // 1. Search Global DB
        DiscogsDto.SearchResponse searchResponse = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/database/search")
                        .queryParam("barcode", barcode)
                        .queryParam("type", "release")
                        .build())
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + user.getDiscogsToken())
                .retrieve()
                .body(DiscogsDto.SearchResponse.class);

        if (searchResponse == null || searchResponse.getResults() == null) {
            return null;
        }

        // 2. Filter by Collection Ownership
        for (DiscogsDto.SearchResult result : searchResponse.getResults()) {
            if (isReleaseInCollection(result.getId(), user)) {
                return getRelease(result.getId(), user);
            }
        }
        return null;
    }

    public boolean isReleaseInCollection(Long releaseId, AppUser user) {
        try {
            restClient.get()
                    .uri("/users/{username}/collection/releases/{releaseId}", user.getDiscogsUsername(), releaseId)
                    .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                    .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + user.getDiscogsToken())
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
