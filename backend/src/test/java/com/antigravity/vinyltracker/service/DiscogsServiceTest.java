package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.fasterxml.jackson.databind.ObjectMapper;
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
        private TokenEncryptionService tokenService;
        private com.antigravity.vinyltracker.repository.ListenEventRepository listenEventRepository;

        @BeforeEach
        void setUp() {
                RestClient.Builder builder = RestClient.builder();

                // Manually create mock server
                server = MockRestServiceServer.bindTo(builder).build();

                // Mock TokenEncryptionService
                tokenService = org.mockito.Mockito.mock(TokenEncryptionService.class);
                org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString()))
                                .thenAnswer(invocation -> invocation.getArgument(0)); // Return token as-is for test

                // Mock ListenEventRepository
                listenEventRepository = org.mockito.Mockito
                                .mock(com.antigravity.vinyltracker.repository.ListenEventRepository.class);

                discogsService = new DiscogsService(builder, tokenService, listenEventRepository);

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

        @Test
        void getCollection_ShouldReturnCollectionFromApi_WhenMinPlaysIsNull() throws Exception {
                // Arrange
                int page = 1;
                int perPage = 50;
                String sort = "artist";
                String sortOrder = "asc";

                // Mock API Response
                DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(100L);
                mockResponse.setReleases(List.of(release));
                mockResponse.setPagination(new DiscogsDto.Pagination(1, 1, 1, 50, null));

                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() +
                                "/collection/folders/0/releases?page=1&per_page=50&sort=artist&sort_order=asc"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(mockResponse),
                                                MediaType.APPLICATION_JSON));

                // Mock Listen Counts (existing logic)
                org.mockito.Mockito.when(listenEventRepository.findRecordsWithPlays(user.getId()))
                                .thenReturn(List.of());

                // Act
                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, page, perPage, sort,
                                sortOrder, null);

                // Assert
                assertNotNull(result);
                assertEquals(1, result.getReleases().size());
                assertEquals(100L, result.getReleases().get(0).getId());
        }

        @Test
        void getCollection_ShouldReturnCollectionFromLocalDb_WhenMinPlaysIsPositive() {
                // Arrange
                int page = 1;
                int perPage = 50;
                String sort = "artist";
                String sortOrder = "asc";
                int minPlays = 1;

                // Mock Local DB Response
                com.antigravity.vinyltracker.model.Record mockRecord = new com.antigravity.vinyltracker.model.Record();
                mockRecord.setDiscogsId(200L);
                mockRecord.setId(1L);
                mockRecord.setTitle("Played Record");
                mockRecord.setArtist("Played Artist");
                mockRecord.setYear("2020");
                mockRecord.setThumbUrl("http://thumb.url");

                Object[] row = new Object[] { mockRecord, 5L }; // Record entity, Count

                java.util.List<Object[]> list = new java.util.ArrayList<>();
                list.add(row);
                org.mockito.Mockito.when(listenEventRepository.findRecordsWithPlays(user.getId()))
                                .thenReturn(list);

                // Act
                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, page, perPage, sort,
                                sortOrder, minPlays);

                // Assert
                assertNotNull(result);
                assertEquals(1, result.getReleases().size());
                DiscogsDto.CollectionRelease release = result.getReleases().get(0);
                assertEquals(200L, release.getId());
                assertEquals(5L, release.getListenCount());
                assertEquals("Played Record", release.getBasicInformation().getTitle());
                assertEquals("Played Artist", release.getBasicInformation().getArtists().get(0).getName());
        }

        @Test
        void getRelease_ShouldThrowException_WhenTokenInvalid() {
                // Arrange
                org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString()))
                                .thenReturn(null);

                // Act & Assert
                assertThrows(RuntimeException.class, () -> discogsService.getRelease(1L, user));
        }

        @Test
        void searchCollectionByBarcode_ShouldThrowException_WhenTokenInvalid() {
                // Arrange
                org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString()))
                                .thenReturn(null);

                // Act & Assert
                assertThrows(RuntimeException.class, () -> discogsService.searchCollectionByBarcode("123", user));
        }

        @Test
        void isReleaseInCollection_ShouldReturnFalse_WhenTokenInvalid() {
                // Arrange
                org.mockito.Mockito.when(tokenService.decrypt(org.mockito.ArgumentMatchers.anyString()))
                                .thenReturn(null);

                // Act
                boolean result = discogsService.isReleaseInCollection(1L, user);

                // Assert
                assertFalse(result);
        }

        @Test
        void isReleaseInCollection_ShouldReturnFalse_WhenApiThrowsException() {
                Long releaseId = 999L;

                // Mock API Error (e.g., 500)
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername()
                                + "/collection/releases/" + releaseId))
                                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

                boolean result = discogsService.isReleaseInCollection(releaseId, user);

                assertFalse(result);
        }

        @Test
        void getAllCollection_ShouldAggregatePages() throws Exception {
                // Arrange
                DiscogsDto.CollectionResponse page1 = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease r1 = new DiscogsDto.CollectionRelease();
                r1.setId(1L);
                page1.setReleases(List.of(r1));
                page1.setPagination(new DiscogsDto.Pagination(1, 1, 2, 2, null)); // 2 pages total

                DiscogsDto.CollectionResponse page2 = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease r2 = new DiscogsDto.CollectionRelease();
                r2.setId(2L);
                page2.setReleases(List.of(r2));
                page2.setPagination(new DiscogsDto.Pagination(2, 2, 2, 2, null));

                // Expect Page 1 Call
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() +
                                "/collection/folders/0/releases?page=1&per_page=100&sort=artist&sort_order=asc"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(page1),
                                                MediaType.APPLICATION_JSON));

                // Expect Page 2 Call
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() +
                                "/collection/folders/0/releases?page=2&per_page=100&sort=artist&sort_order=asc"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(page2),
                                                MediaType.APPLICATION_JSON));

                org.mockito.Mockito.when(listenEventRepository.findRecordsWithPlays(user.getId()))
                                .thenReturn(java.util.Collections.emptyList());

                // Act
                List<DiscogsDto.CollectionRelease> result = discogsService.getAllCollection(user);

                // Assert
                assertEquals(2, result.size());
                assertEquals(1L, result.get(0).getId());
                assertEquals(2L, result.get(1).getId());
        }

        @Test
        void getCollection_ShouldHandleEmptyResponse() throws Exception {
                // Arrange
                int page = 1;
                int perPage = 50;

                // Return null/empty
                server.expect(requestTo("https://api.discogs.com/users/" + user.getDiscogsUsername() +
                                "/collection/folders/0/releases?page=1&per_page=50&sort=artist&sort_order=asc"))
                                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON)); // Empty JSON object

                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, page, perPage, "artist",
                                "asc", 0);

                assertNotNull(result);
                assertNull(result.getReleases());
        }
}
