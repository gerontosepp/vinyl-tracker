package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.DiscogsTokenException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.cache.annotation.Cacheable;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;

import java.util.function.Supplier;

@Service
@lombok.extern.slf4j.Slf4j
public class DiscogsApiClient {

    private final RestClient restClient;
    private final TokenEncryptionService tokenService;
    private final RateLimiter discogsRateLimiter;
    private final Retry discogsRetry;
    private static final String BASE_URL = "https://api.discogs.com";

    public DiscogsApiClient(RestClient.Builder restClientBuilder, 
                            TokenEncryptionService tokenService,
                            RateLimiterRegistry rateLimiterRegistry,
                            RetryRegistry retryRegistry) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
        this.tokenService = tokenService;
        this.discogsRateLimiter = rateLimiterRegistry.rateLimiter("discogs");
        this.discogsRetry = retryRegistry.retry("discogs");
    }

    private <T> T executeWithRateLimit(Supplier<T> supplier) {
        return RateLimiter.decorateSupplier(discogsRateLimiter,
                Retry.decorateSupplier(discogsRetry, supplier)).get();
    }

    private String getDecryptedToken(AppUser user) {
        String token = tokenService.decrypt(user.getDiscogsToken());
        if (token == null) {
            throw new DiscogsTokenException("Could not decrypt Discogs token for user " + user.getUsername());
        }
        return token;
    }

    @Cacheable(value = "discogsReleases", key = "#releaseId")
    public DiscogsDto.Release getRelease(Long releaseId, AppUser user) {
        log.info("Fetching release details for ID: {}", releaseId);
        return executeWithRateLimit(() -> restClient.get()
                .uri("/releases/{id}", releaseId)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + getDecryptedToken(user))
                .retrieve()
                .body(DiscogsDto.Release.class));
    }

    public DiscogsDto.SearchResponse searchDatabaseByBarcode(String barcode, AppUser user) {
        log.info("Searching Discogs Database for barcode: {}", barcode);
        return executeWithRateLimit(() -> restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/database/search")
                        .queryParam("barcode", barcode)
                        .queryParam("type", "release")
                        .build())
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + getDecryptedToken(user))
                .retrieve()
                .body(DiscogsDto.SearchResponse.class));
    }

    public DiscogsDto.SearchResponse searchDatabase(String query, String type, int page, int perPage, AppUser user) {
        log.info("Searching Discogs Database for query: {}, type: {}, page: {}, perPage: {}", query, type, page, perPage);
        return executeWithRateLimit(() -> restClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/database/search")
                            .queryParam("q", query)
                            .queryParam("page", page)
                            .queryParam("per_page", perPage);
                    if (type != null && !type.isBlank()) {
                        builder.queryParam("type", type);
                    }
                    return builder.build();
                })
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + getDecryptedToken(user))
                .retrieve()
                .body(DiscogsDto.SearchResponse.class));
    }

    public boolean isReleaseInCollection(Long releaseId, AppUser user) {
        String token = tokenService.decrypt(user.getDiscogsToken());
        if (token == null) return false;

        try {
            executeWithRateLimit(() -> restClient.get()
                    .uri("/users/{username}/collection/releases/{releaseId}", user.getDiscogsUsername(), releaseId)
                    .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                    .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + token)
                    .retrieve()
                    .toBodilessEntity());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public DiscogsDto.ValueResponse getCollectionValue(AppUser user) {
        log.info("Fetching collection value for user: {}", user.getUsername());
        return executeWithRateLimit(() -> restClient.get()
                .uri("/users/{username}/collection/value", user.getDiscogsUsername())
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + getDecryptedToken(user))
                .retrieve()
                .body(DiscogsDto.ValueResponse.class));
    }

    public DiscogsDto.CollectionResponse getCollectionReleases(AppUser user, int page, int perPage) {
        log.info("Fetching Discogs page {} for user {}", page, user.getUsername());
        return executeWithRateLimit(() -> restClient.get()
                .uri("/users/{username}/collection/folders/0/releases?page={page}&per_page={perPage}&sort={sort}&sort_order={sortOrder}",
                        user.getDiscogsUsername(), page, perPage, "artist", "asc")
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + getDecryptedToken(user))
                .retrieve()
                .body(DiscogsDto.CollectionResponse.class));
    }
}
