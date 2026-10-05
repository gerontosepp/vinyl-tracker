package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class CollectionSyncServiceTest {

    private CollectionSyncService collectionSyncService;
    private DiscogsApiClient discogsApiClient;
    private RecordRepository recordRepository;
    private CollectionItemRepository collectionItemRepository;
    private AppUser user;

    @BeforeEach
    void setUp() {
        discogsApiClient = Mockito.mock(DiscogsApiClient.class);
        recordRepository = Mockito.mock(RecordRepository.class);
        collectionItemRepository = Mockito.mock(CollectionItemRepository.class);

        collectionSyncService = new CollectionSyncService(discogsApiClient, recordRepository, collectionItemRepository);

        user = new AppUser();
        user.setUsername("testuser");
    }

    @Test
    void syncCollection_ShouldHandleNewRecordsAndOptionalFields() {
        DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setPage(1);
        pagination.setPages(1);
        pagination.setPerPage(100);
        pagination.setItems(1);
        mockResponse.setPagination(pagination);

        DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
        release.setId(12345L);
        release.setInstanceId(67890L);
        DiscogsDto.Release releaseInfo = new DiscogsDto.Release();
        releaseInfo.setId(12345L);
        releaseInfo.setTitle("Test Album");
        releaseInfo.setYear(null);
        releaseInfo.setThumbUrl("https://example.com/thumb.jpg");
        releaseInfo.setCoverImage("https://example.com/cover.jpg");
        releaseInfo.setGenres(List.of("Electronic"));
        releaseInfo.setStyles(List.of("House"));
        DiscogsDto.Artist artist = new DiscogsDto.Artist();
        artist.setName("Test Artist");
        releaseInfo.setArtists(List.of(artist));
        release.setBasicInformation(releaseInfo);
        mockResponse.setReleases(List.of(release));

        Mockito.when(discogsApiClient.getCollectionReleases(user, 1, 100))
                .thenReturn(mockResponse);

        Mockito.when(recordRepository.findByDiscogsId(12345L))
                .thenReturn(Optional.empty());

        Mockito.when(recordRepository.save(Mockito.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Mockito.when(collectionItemRepository.findByUserAndInstanceId(user, 67890L))
                .thenReturn(Optional.empty());

        Mockito.when(collectionItemRepository.findAllByUser(user))
                .thenReturn(List.of());

        com.antigravity.vinyltracker.model.dto.SyncResultDto result = collectionSyncService.syncCollection(user);

        assertNotNull(result);
        assertEquals(1, result.getAdded());
        assertEquals(0, result.getRemoved());
    }

    @Test
    void syncCollection_ShouldUpdateAddedAtForExistingItem() {
        DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setPage(1);
        pagination.setPages(1);
        pagination.setPerPage(100);
        pagination.setItems(1);
        mockResponse.setPagination(pagination);

        DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
        release.setId(12345L);
        release.setInstanceId(67890L);
        release.setDateAdded("2024-02-10T03:19:08-08:00");
        DiscogsDto.Release releaseInfo = new DiscogsDto.Release();
        releaseInfo.setId(12345L);
        releaseInfo.setTitle("Test Album");
        release.setBasicInformation(releaseInfo);
        mockResponse.setReleases(List.of(release));

        Mockito.when(discogsApiClient.getCollectionReleases(user, 1, 100))
                .thenReturn(mockResponse);

        com.antigravity.vinyltracker.model.Record record = new com.antigravity.vinyltracker.model.Record();
        record.setDiscogsId(12345L);
        Mockito.when(recordRepository.findByDiscogsId(12345L))
                .thenReturn(Optional.of(record));

        com.antigravity.vinyltracker.model.CollectionItem existingItem = new com.antigravity.vinyltracker.model.CollectionItem(
                user, record, 67890L, java.time.LocalDateTime.of(2020, 1, 1, 0, 0));
        Mockito.when(collectionItemRepository.findByUserAndInstanceId(user, 67890L))
                .thenReturn(Optional.of(existingItem));

        Mockito.when(collectionItemRepository.findAllByUser(user))
                .thenReturn(List.of(existingItem));

        com.antigravity.vinyltracker.model.dto.SyncResultDto result = collectionSyncService.syncCollection(user);

        assertNotNull(result);
        assertEquals(0, result.getAdded());
        assertEquals(java.time.LocalDateTime.of(2024, 2, 10, 11, 19, 8), existingItem.getAddedAt());
        Mockito.verify(collectionItemRepository).save(existingItem);
    }
}
