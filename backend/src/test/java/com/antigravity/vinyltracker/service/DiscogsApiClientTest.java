package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.DiscogsTokenException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.RetryRegistry;
import io.github.resilience4j.retry.RetryConfig;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DiscogsApiClientTest {

    private DiscogsApiClient discogsApiClient;
    private MockRestServiceServer server;
    private ObjectMapper objectMapper = new ObjectMapper();
    private AppUser user;
    private TokenEncryptionService tokenService;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        tokenService = org.mockito.Mockito.mock(TokenEncryptionService.class);
        org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RateLimiterRegistry rateLimiterRegistry = RateLimiterRegistry.ofDefaults();
        RetryConfig retryConfig = RetryConfig.custom().maxAttempts(1).build();
        RetryRegistry retryRegistry = RetryRegistry.of(retryConfig);
        discogsApiClient = new DiscogsApiClient(builder, tokenService, rateLimiterRegistry, retryRegistry);
        user = new AppUser();
        user.setUsername("testuser");
        user.setDiscogsUsername("testdiscogs");
        user.setDiscogsToken("testtoken");
    }

    @Test
    void getRelease_ShouldReturnRelease() throws Exception {
        Long releaseId = 12345L;
        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);
        mockRelease.setTitle("Test Release");
        mockRelease.setYear(2023);

        server.expect(requestTo("https://api.discogs.com/releases/" + releaseId))
                .andRespond(withSuccess(objectMapper.writeValueAsString(mockRelease), MediaType.APPLICATION_JSON));

        DiscogsDto.Release result = discogsApiClient.getRelease(releaseId, user);

        assertNotNull(result);
        assertEquals(releaseId, result.getId());
        assertEquals("Test Release", result.getTitle());
    }

    @Test
    void searchDatabaseByBarcode_ShouldReturnSearchResponse() throws Exception {
        String barcode = "123456789";
        Long releaseId = 12345L;

        DiscogsDto.SearchResult searchResult = new DiscogsDto.SearchResult();
        searchResult.setId(releaseId);
        DiscogsDto.SearchResponse searchResponse = new DiscogsDto.SearchResponse();
        searchResponse.setResults(List.of(searchResult));

        server.expect(requestTo("https://api.discogs.com/database/search?barcode=" + barcode + "&type=release"))
                .andRespond(withSuccess(objectMapper.writeValueAsString(searchResponse), MediaType.APPLICATION_JSON));

        DiscogsDto.SearchResponse result = discogsApiClient.searchDatabaseByBarcode(barcode, user);

        assertNotNull(result);
        assertFalse(result.getResults().isEmpty());
        assertEquals(releaseId, result.getResults().get(0).getId());
    }

    @Test
    void isReleaseInCollection_ShouldReturnTrue_WhenInCollection() throws Exception {
        Long releaseId = 100L;
        DiscogsDto.CollectionRelease colRel = new DiscogsDto.CollectionRelease();
        colRel.setId(releaseId);
        DiscogsDto.CollectionResponse response = new DiscogsDto.CollectionResponse();
        response.setReleases(List.of(colRel));

        server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() + "/collection/releases/" + releaseId))
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        boolean result = discogsApiClient.isReleaseInCollection(releaseId, user);
        assertTrue(result);
    }

    @Test
    void isReleaseInCollection_ShouldReturnFalse_WhenNotInCollection() throws Exception {
        Long releaseId = 100L;
        DiscogsDto.CollectionResponse response = new DiscogsDto.CollectionResponse();
        response.setReleases(List.of());

        server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() + "/collection/releases/" + releaseId))
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        boolean result = discogsApiClient.isReleaseInCollection(releaseId, user);
        assertFalse(result);
    }

    @Test
    void getCollectionValue_ShouldReturnValueResponse() throws Exception {
        DiscogsDto.ValueResponse mockResponse = new DiscogsDto.ValueResponse();
        mockResponse.setMedian(new DiscogsDto.ValueData("USD", 300.00));

        server.expect(requestTo("https://api.discogs.com/users/testdiscogs/collection/value"))
                .andRespond(withSuccess(objectMapper.writeValueAsString(mockResponse), MediaType.APPLICATION_JSON));

        DiscogsDto.ValueResponse result = discogsApiClient.getCollectionValue(user);

        assertNotNull(result);
        assertEquals("USD", result.getMedian().getCurrency());
        assertEquals(300.00, result.getMedian().getValue());
    }

    @Test
    void getCollectionReleases_ShouldReturnCollectionResponse() throws Exception {
        DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setPage(1);
        mockResponse.setPagination(pagination);

        server.expect(requestTo("https://api.discogs.com/users/testdiscogs/collection/folders/0/releases?page=1&per_page=50&sort=artist&sort_order=asc"))
                .andRespond(withSuccess(objectMapper.writeValueAsString(mockResponse), MediaType.APPLICATION_JSON));

        DiscogsDto.CollectionResponse result = discogsApiClient.getCollectionReleases(user, 1, 50);

        assertNotNull(result);
        assertEquals(1, result.getPagination().getPage());
    }

    @Test
    void apiMethods_ShouldThrowException_WhenTokenInvalid() {
        org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString())).thenReturn(null);

        assertThrows(DiscogsTokenException.class, () -> discogsApiClient.getRelease(1L, user));
        assertThrows(DiscogsTokenException.class, () -> discogsApiClient.searchDatabaseByBarcode("123", user));
        assertFalse(discogsApiClient.isReleaseInCollection(1L, user));
        assertThrows(DiscogsTokenException.class, () -> discogsApiClient.getCollectionValue(user));
        assertThrows(DiscogsTokenException.class, () -> discogsApiClient.getCollectionReleases(user, 1, 50));
    }

    @Test
    void getRelease_ShouldRetryOn5xxServerError_AndSucceedOnRetry() throws Exception {
        Long releaseId = 12345L;
        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);

        // Configure a separate client with retry config matching production
        RestClient.Builder testBuilder = RestClient.builder();
        MockRestServiceServer testServer = MockRestServiceServer.bindTo(testBuilder).build();
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(java.time.Duration.ofMillis(5))
                .retryExceptions(
                        org.springframework.web.client.HttpServerErrorException.class,
                        org.springframework.web.client.HttpClientErrorException.TooManyRequests.class,
                        org.springframework.web.client.ResourceAccessException.class,
                        java.io.IOException.class
                )
                .build();
        RetryRegistry retryRegistry = RetryRegistry.of(config);
        DiscogsApiClient clientWithRetry = new DiscogsApiClient(
                testBuilder, 
                tokenService, 
                RateLimiterRegistry.ofDefaults(), 
                retryRegistry
        );

        // 1st call: Fail with 500, 2nd call: Succeed with 200
        testServer.expect(requestTo("https://api.discogs.com/releases/" + releaseId))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        testServer.expect(requestTo("https://api.discogs.com/releases/" + releaseId))
                .andRespond(withSuccess(objectMapper.writeValueAsString(mockRelease), MediaType.APPLICATION_JSON));

        DiscogsDto.Release result = clientWithRetry.getRelease(releaseId, user);
        assertNotNull(result);
        assertEquals(releaseId, result.getId());
        testServer.verify();
    }

    @Test
    void getRelease_ShouldNotRetryOn404NotFoundError() throws Exception {
        Long releaseId = 12345L;

        // Configure a separate client with retry config matching production
        RestClient.Builder testBuilder = RestClient.builder();
        MockRestServiceServer testServer = MockRestServiceServer.bindTo(testBuilder).build();
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(java.time.Duration.ofMillis(5))
                .retryExceptions(
                        org.springframework.web.client.HttpServerErrorException.class,
                        org.springframework.web.client.HttpClientErrorException.TooManyRequests.class,
                        org.springframework.web.client.ResourceAccessException.class,
                        java.io.IOException.class
                )
                .build();
        RetryRegistry retryRegistry = RetryRegistry.of(config);
        DiscogsApiClient clientWithRetry = new DiscogsApiClient(
                testBuilder, 
                tokenService, 
                RateLimiterRegistry.ofDefaults(), 
                retryRegistry
        );

        // Expect exactly 1 request returning 404 (No retry should happen)
        testServer.expect(requestTo("https://api.discogs.com/releases/" + releaseId))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThrows(org.springframework.web.client.HttpClientErrorException.NotFound.class, () -> {
            clientWithRetry.getRelease(releaseId, user);
        });
        testServer.verify();
    }
}
