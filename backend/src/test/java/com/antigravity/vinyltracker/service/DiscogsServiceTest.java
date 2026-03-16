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
        private com.antigravity.vinyltracker.repository.RecordRepository recordRepository;
        private com.antigravity.vinyltracker.repository.CollectionItemRepository collectionItemRepository;

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

                // Mock RecordRepository and CollectionItemRepository
                recordRepository = org.mockito.Mockito
                                .mock(com.antigravity.vinyltracker.repository.RecordRepository.class);
                collectionItemRepository = org.mockito.Mockito
                                .mock(com.antigravity.vinyltracker.repository.CollectionItemRepository.class);

                discogsService = new DiscogsService(builder, tokenService, listenEventRepository, recordRepository,
                                collectionItemRepository);

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
        void getCollection_ShouldReturnCollectionFromLocalDb() {
                int page = 1;
                int perPage = 50;
                String sort = "artist";
                String sortOrder = "asc";

                com.antigravity.vinyltracker.model.Record mockRecord = new com.antigravity.vinyltracker.model.Record();
                mockRecord.setDiscogsId(100L);
                mockRecord.setTitle("Test Title");
                mockRecord.setArtist("Test Artist");

                com.antigravity.vinyltracker.model.CollectionItem item = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord, 10L);

                org.springframework.data.domain.Page<com.antigravity.vinyltracker.model.CollectionItem> mockPage = new org.springframework.data.domain.PageImpl<>(
                                List.of(item));

                org.mockito.Mockito.when(collectionItemRepository.findAllByUser(
                                org.mockito.ArgumentMatchers.eq(user),
                                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)))
                                .thenReturn(mockPage);

                org.mockito.Mockito.when(listenEventRepository.countByRecordAndUser(
                                org.mockito.ArgumentMatchers.eq(mockRecord),
                                org.mockito.ArgumentMatchers.eq(user))).thenReturn(5L);

                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, page, perPage, sort,
                                sortOrder, null, null);

                assertNotNull(result);
                assertEquals(1, result.getReleases().size());
                assertEquals(100L, result.getReleases().get(0).getId());
                assertEquals(5L, result.getReleases().get(0).getListenCount());
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
        void getAllCollection_ShouldAggregateFromLocalDb() {
                com.antigravity.vinyltracker.model.Record mockRecord1 = new com.antigravity.vinyltracker.model.Record();
                mockRecord1.setDiscogsId(1L);
                com.antigravity.vinyltracker.model.CollectionItem item1 = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord1, 10L);

                com.antigravity.vinyltracker.model.Record mockRecord2 = new com.antigravity.vinyltracker.model.Record();
                mockRecord2.setDiscogsId(2L);
                com.antigravity.vinyltracker.model.CollectionItem item2 = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord2, 20L);

                org.mockito.Mockito.when(collectionItemRepository.findAllByUser(user))
                                .thenReturn(List.of(item1, item2));

                org.mockito.Mockito.when(listenEventRepository.countByRecordAndUser(org.mockito.ArgumentMatchers.any(),
                                org.mockito.ArgumentMatchers.eq(user))).thenReturn(0L);

                List<DiscogsDto.CollectionRelease> result = discogsService.getAllCollection(user);

                assertEquals(2, result.size());
                assertEquals(1L, result.get(0).getId());
                assertEquals(2L, result.get(1).getId());
        }

        @Test
        void getCollection_ShouldHandleEmptyResponse() {
                org.mockito.Mockito.when(collectionItemRepository.findAllByUser(
                                org.mockito.ArgumentMatchers.eq(user),
                                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)))
                                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

                DiscogsDto.CollectionResponse response = discogsService.getCollection(user, 1, 10, "artist", "asc",
                                null, null);

                assertNotNull(response);
                assertTrue(response.getReleases().isEmpty());
        }

        @Test
        void getCollection_ShouldSortByListensDesc_WhenSortIsListens() {
                com.antigravity.vinyltracker.model.Record mockRecord1 = new com.antigravity.vinyltracker.model.Record();
                mockRecord1.setDiscogsId(100L);
                com.antigravity.vinyltracker.model.CollectionItem item1 = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord1, 1L);

                com.antigravity.vinyltracker.model.Record mockRecord2 = new com.antigravity.vinyltracker.model.Record();
                mockRecord2.setDiscogsId(200L);
                com.antigravity.vinyltracker.model.CollectionItem item2 = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord2, 2L);

                Object[] row1 = new Object[] { item2, 5L }; // 5 plays
                Object[] row2 = new Object[] { item1, 2L }; // 2 plays

                org.springframework.data.domain.Page<Object[]> mockPage = new org.springframework.data.domain.PageImpl<>(
                                List.of(row1, row2));

                org.mockito.Mockito.when(collectionItemRepository.findAllByUserOrderByPlayCountDesc(
                                org.mockito.ArgumentMatchers.eq(user),
                                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)))
                                .thenReturn(mockPage);

                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, 1, 50, "listens", "desc", 0,
                                null);

                assertNotNull(result);
                assertEquals(2, result.getReleases().size());
                assertEquals(200L, result.getReleases().get(0).getId());
                assertEquals(5L, result.getReleases().get(0).getListenCount());
                assertEquals(100L, result.getReleases().get(1).getId());
                assertEquals(2L, result.getReleases().get(1).getListenCount());
        }

        @Test
        void getCollectionValue_ShouldReturnValueResponse() throws Exception {
                DiscogsDto.ValueResponse mockResponse = new DiscogsDto.ValueResponse();
                mockResponse.setMinimum(new DiscogsDto.ValueData("USD", 150.00));
                mockResponse.setMedian(new DiscogsDto.ValueData("USD", 300.00));
                mockResponse.setMaximum(new DiscogsDto.ValueData("USD", 5000.00));

                server.expect(requestTo("https://api.discogs.com/users/testdiscogs/collection/value"))
                                .andRespond(withSuccess(objectMapper.writeValueAsString(mockResponse),
                                                MediaType.APPLICATION_JSON));

                DiscogsDto.ValueResponse result = discogsService.getCollectionValue(user);

                assertNotNull(result);
                assertEquals("USD", result.getMedian().getCurrency());
                assertEquals(300.00, result.getMedian().getValue());
        }

        @Test
        void getCollectionValue_ShouldParseTextualDiscogsValueResponse() {
                String responseJson = """
                                {
                                  \"minimum\": \"$150.00\",
                                  \"median\": \"$300.50\",
                                  \"maximum\": \"$5,000.75\"
                                }
                                """;

                server.expect(requestTo("https://api.discogs.com/users/testdiscogs/collection/value"))
                                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));

                DiscogsDto.ValueResponse result = discogsService.getCollectionValue(user);

                assertNotNull(result);
                assertNotNull(result.getMedian());
                assertEquals("$", result.getMedian().getCurrency());
                assertEquals(300.50, result.getMedian().getValue());
                assertEquals(5000.75, result.getMaximum().getValue());
        }

                                @Test
                                void syncCollection_ShouldHandleOptionalYearAndUnknownFields() {
                                                                String responseJson = """
                                                                                                                                {
                                                                                                                                        \"pagination\": {
                                                                                                                                                \"page\": 1,
                                                                                                                                                \"pages\": 1,
                                                                                                                                                \"per_page\": 100,
                                                                                                                                                \"items\": 1,
                                                                                                                                                \"urls\": {}
                                                                                                                                        },
                                                                                                                                        \"releases\": [
                                                                                                                                                {
                                                                                                                                                        \"id\": 12345,
                                                                                                                                                        \"instance_id\": 67890,
                                                                                                                                                        \"rating\": 0,
                                                                                                                                                        \"date_added\": \"2024-02-01T00:00:00-08:00\",
                                                                                                                                                        \"extra_field\": \"ignore me\",
                                                                                                                                                        \"basic_information\": {
                                                                                                                                                                \"id\": 12345,
                                                                                                                                                                \"title\": \"Test Album\",
                                                                                                                                                                \"year\": null,
                                                                                                                                                                \"thumb\": \"https://example.com/thumb.jpg\",
                                                                                                                                                                \"cover_image\": \"https://example.com/cover.jpg\",
                                                                                                                                                                \"genres\": [\"Electronic\"],
                                                                                                                                                                \"styles\": [\"House\"],
                                                                                                                                                                \"artists\": [{ \"name\": \"Test Artist\", \"anv\": \"Ignored\" }],
                                                                                                                                                                \"labels\": []
                                                                                                                                                        }
                                                                                                                                                }
                                                                                                                                        ]
                                                                                                                                }
                                                                                                                                """;

                                                                server.expect(requestTo("https://api.discogs.com/users/testdiscogs/collection/folders/0/releases?page=1&per_page=100&sort=artist&sort_order=asc"))
                                                                                                                                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));

                                                                org.mockito.Mockito.when(recordRepository.findByDiscogsId(12345L))
                                                                                                                                .thenReturn(java.util.Optional.empty());
                                                                org.mockito.Mockito.when(recordRepository.save(org.mockito.ArgumentMatchers.any()))
                                                                                                                                .thenAnswer(invocation -> invocation.getArgument(0));
                                                                org.mockito.Mockito.when(collectionItemRepository.findByUserAndInstanceId(user, 67890L))
                                                                                                                                .thenReturn(java.util.Optional.empty());
                                                                org.mockito.Mockito.when(collectionItemRepository.findAllByUser(user))
                                                                                                                                .thenReturn(List.of());

                                                                com.antigravity.vinyltracker.model.dto.SyncResultDto result = discogsService.syncCollection(user);

                                                                assertNotNull(result);
                                                                assertEquals(1, result.getAdded());
                                                                assertEquals(0, result.getRemoved());
                                }

        @Test
        void getCollection_ShouldMapGenresFromRecord() {
                com.antigravity.vinyltracker.model.Record mockRecord = new com.antigravity.vinyltracker.model.Record();
                mockRecord.setDiscogsId(100L);
                mockRecord.setTitle("Genre Test");
                mockRecord.setArtist("Genre Artist");
                mockRecord.setGenres(List.of("Rock", "Post Punk"));

                com.antigravity.vinyltracker.model.CollectionItem item = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, mockRecord, 10L);

                org.springframework.data.domain.Page<com.antigravity.vinyltracker.model.CollectionItem> mockPage = new org.springframework.data.domain.PageImpl<>(
                                List.of(item));

                org.mockito.Mockito.when(collectionItemRepository.findAllByUser(
                                org.mockito.ArgumentMatchers.eq(user),
                                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)))
                                .thenReturn(mockPage);

                org.mockito.Mockito.when(listenEventRepository.countByRecordAndUser(
                                org.mockito.ArgumentMatchers.eq(mockRecord),
                                org.mockito.ArgumentMatchers.eq(user))).thenReturn(1L);

                DiscogsDto.CollectionResponse result = discogsService.getCollection(user, 1, 50, "artist", "asc",
                                null, null);

                assertNotNull(result);
                assertEquals(1, result.getReleases().size());
                assertNotNull(result.getReleases().get(0).getBasicInformation().getGenres());
                assertEquals(2, result.getReleases().get(0).getBasicInformation().getGenres().size());
                assertTrue(result.getReleases().get(0).getBasicInformation().getGenres().contains("Rock"));
        }
}
