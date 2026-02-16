package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DiscogsServiceTest {

        private DiscogsService discogsService;

        private MockRestServiceServer server;

        private ObjectMapper objectMapper = new ObjectMapper();

        private AppUser user;

        @BeforeEach
        void setUp() {
                RestClient.Builder builder = RestClient.builder();
                server = MockRestServiceServer.bindTo(builder).build();
                discogsService = new DiscogsService(builder);

                user = new AppUser();
                user.setDiscogsUsername("testuser");
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
                                .andRespond(withSuccess(objectMapper.writeValueAsString(mockRelease),
                                                MediaType.APPLICATION_JSON));

                DiscogsDto.Release result = discogsService.getRelease(releaseId, user);

                assertNotNull(result);
                assertEquals(releaseId, result.getId());
                assertEquals("Test Release", result.getTitle());
        }

        @Test
        void searchCollectionByBarcode_ShouldReturnRelease_WhenInCollection() throws Exception {
                String barcode = "123456789";
                Long releaseId = 12345L;

                // Mock Search Response
                DiscogsDto.SearchResult searchResult = new DiscogsDto.SearchResult();
                searchResult.setId(releaseId);
                DiscogsDto.SearchResponse searchResponse = new DiscogsDto.SearchResponse();
                searchResponse.setResults(List.of(searchResult));

                server.expect(requestTo("https://api.discogs.com/database/search?barcode=" + barcode + "&type=release"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(searchResponse),
                                                MediaType.APPLICATION_JSON));

                // Mock Collection Check (isReleaseInCollection) -> Success (200 OK)
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername()
                                + "/collection/releases/" + releaseId))
                                .andRespond(withSuccess());

                // Mock Get Release
                DiscogsDto.Release mockRelease = new DiscogsDto.Release();
                mockRelease.setId(releaseId);
                mockRelease.setTitle("Found Release");

                server.expect(requestTo("https://api.discogs.com/releases/" + releaseId))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(mockRelease),
                                                MediaType.APPLICATION_JSON));

                DiscogsDto.Release result = discogsService.searchCollectionByBarcode(barcode, user);

                assertNotNull(result);
                assertEquals("Found Release", result.getTitle());
        }

        @Test
        void searchCollectionByBarcode_ShouldReturnNull_WhenNotInCollection() throws Exception {
                String barcode = "987654321";
                Long releaseId = 54321L;

                // Mock Search Response matches global DB
                DiscogsDto.SearchResult searchResult = new DiscogsDto.SearchResult();
                searchResult.setId(releaseId);
                DiscogsDto.SearchResponse searchResponse = new DiscogsDto.SearchResponse();
                searchResponse.setResults(List.of(searchResult));

                server.expect(requestTo("https://api.discogs.com/database/search?barcode=" + barcode + "&type=release"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(searchResponse),
                                                MediaType.APPLICATION_JSON));

                // Mock Collection Check fail (404 Not Found)
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername()
                                + "/collection/releases/" + releaseId))
                                .andRespond(withStatus(HttpStatus.NOT_FOUND).body("")
                                                .contentType(MediaType.APPLICATION_JSON));

                DiscogsDto.Release result = discogsService.searchCollectionByBarcode(barcode, user);

                assertNull(result);
        }
}
