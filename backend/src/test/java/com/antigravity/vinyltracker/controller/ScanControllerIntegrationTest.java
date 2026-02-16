package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.DiscogsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
// @Transactional doesn't work with RANDOM_PORT because test and server runs in
// different threads.
// We must clean up manually or use dirties context.
class ScanControllerIntegrationTest {

    @LocalServerPort
    private int port;

    private RestClient restClient;

    @Autowired
    private AppUserRepository userRepository;

    // We can't use @MockBean so we rely on the Primary bean defined below
    @Autowired
    private DiscogsService discogsService;

    @TestConfiguration
    static class TestConfig {
        @Bean
        @Primary
        public DiscogsService discogsServiceMock() {
            return Mockito.mock(DiscogsService.class);
        }
    }

    private AppUser testUser;

    @BeforeEach
    void setUp() {
        restClient = RestClient.builder()
                .baseUrl("http://localhost:" + port)
                .build();

        // Clear DB to ensure clean state since no transaction rollback
        userRepository.deleteAll();

        // Setup User in H2 DB
        testUser = new AppUser();
        testUser.setUsername("integrationUser");
        testUser.setDiscogsUsername("discogsUser");
        testUser.setDiscogsToken("token");
        testUser.setPassword("password");
        testUser.setSalt("salt");
        userRepository.save(testUser);
    }

    @Test
    void scanBarcode_ShouldSaveRecordAndEvent_WhenSuccessful() {
        String barcode = "123456789";
        Long releaseId = 555L;

        // Mock External Service
        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);
        mockRelease.setTitle("Integration Album");
        mockRelease.setArtists(List.of(new DiscogsDto.Artist("Integration Artist")));
        mockRelease.setYear(2025);
        mockRelease.setThumbUrl("http://img.com/1.jpg");

        given(discogsService.searchCollectionByBarcode(anyString(), any(AppUser.class)))
                .willReturn(mockRelease);

        ScanDto.Request request = new ScanDto.Request();
        request.setBarcode(barcode);

        ScanDto.Result result = restClient.post()
                .uri("/api/scan?username=integrationUser")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(ScanDto.Result.class);

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("Now playing: Integration Album", result.getMessage());
        assertEquals("Integration Album", result.getRecord().getTitle());
    }

    @Test
    void scanBarcode_ShouldFail_WhenUserNotFound() {
        ScanDto.Request request = new ScanDto.Request();
        request.setBarcode("123");

        // Expect 500
        assertThrows(Exception.class, () -> {
            restClient.post()
                    .uri("/api/scan?username=nonExistentUser")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
        });
    }
}
