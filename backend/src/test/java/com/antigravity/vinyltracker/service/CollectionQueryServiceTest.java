package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CollectionQueryServiceTest {

    private CollectionQueryService collectionQueryService;
    private ListenEventRepository listenEventRepository;
    private CollectionItemRepository collectionItemRepository;
    private AppUser user;

    @BeforeEach
    void setUp() {
        listenEventRepository = Mockito.mock(ListenEventRepository.class);
        collectionItemRepository = Mockito.mock(CollectionItemRepository.class);
        collectionQueryService = new CollectionQueryService(listenEventRepository, collectionItemRepository);

        user = new AppUser();
        user.setUsername("testuser");
    }

    @Test
    void getCollection_ShouldReturnCollectionFromLocalDb() {
        int page = 1;
        int perPage = 50;

        com.antigravity.vinyltracker.model.Record mockRecord = new com.antigravity.vinyltracker.model.Record();
        mockRecord.setDiscogsId(100L);
        mockRecord.setTitle("Test Title");
        mockRecord.setArtist("Test Artist");

        com.antigravity.vinyltracker.model.CollectionItem item = new com.antigravity.vinyltracker.model.CollectionItem(
                user, mockRecord, 10L);

        Page<com.antigravity.vinyltracker.model.CollectionItem> mockPage = new PageImpl<>(List.of(item));

        Mockito.when(collectionItemRepository.findAllByUser(
                        Mockito.eq(user),
                        Mockito.any(Pageable.class)))
                .thenReturn(mockPage);

        Mockito.when(listenEventRepository.countByRecordAndUser(
                Mockito.eq(mockRecord),
                Mockito.eq(user))).thenReturn(5L);

        DiscogsDto.CollectionResponse result = collectionQueryService.getCollection(user, page, perPage, "artist", "asc", null, null);

        assertNotNull(result);
        assertEquals(1, result.getReleases().size());
        assertEquals(100L, result.getReleases().get(0).getId());
        assertEquals(5L, result.getReleases().get(0).getListenCount());
        assertEquals("LP", result.getReleases().get(0).getBasicInformation().getFormat());
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

        Mockito.when(collectionItemRepository.findAllByUser(user)).thenReturn(List.of(item1, item2));
        Mockito.when(listenEventRepository.countByRecordAndUser(Mockito.any(), Mockito.eq(user))).thenReturn(0L);

        List<DiscogsDto.CollectionRelease> result = collectionQueryService.getAllCollection(user);

        assertEquals(2, result.size());
        assertEquals(1L, result.get(0).getId());
        assertEquals(2L, result.get(1).getId());
    }

    @Test
    void getCollection_ShouldHandleEmptyResponse() {
        Mockito.when(collectionItemRepository.findAllByUser(
                        Mockito.eq(user),
                        Mockito.any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        DiscogsDto.CollectionResponse response = collectionQueryService.getCollection(user, 1, 10, "artist", "asc", null, null);

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

        Page<Object[]> mockPage = new PageImpl<>(List.of(row1, row2));

        Mockito.when(collectionItemRepository.findAllByUserOrderByPlayCountDesc(
                        Mockito.eq(user),
                        Mockito.any(Pageable.class)))
                .thenReturn(mockPage);

        DiscogsDto.CollectionResponse result = collectionQueryService.getCollection(user, 1, 50, "listens", "desc", 0, null);

        assertNotNull(result);
        assertEquals(2, result.getReleases().size());
        assertEquals(200L, result.getReleases().get(0).getId());
        assertEquals(5L, result.getReleases().get(0).getListenCount());
        assertEquals(100L, result.getReleases().get(1).getId());
        assertEquals(2L, result.getReleases().get(1).getListenCount());
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

        Page<com.antigravity.vinyltracker.model.CollectionItem> mockPage = new PageImpl<>(List.of(item));

        Mockito.when(collectionItemRepository.findAllByUser(
                        Mockito.eq(user),
                        Mockito.any(Pageable.class)))
                .thenReturn(mockPage);

        Mockito.when(listenEventRepository.countByRecordAndUser(
                Mockito.eq(mockRecord),
                Mockito.eq(user))).thenReturn(1L);

        DiscogsDto.CollectionResponse result = collectionQueryService.getCollection(user, 1, 50, "artist", "asc", null, null);

        assertNotNull(result);
        assertEquals(1, result.getReleases().size());
        assertNotNull(result.getReleases().get(0).getBasicInformation().getGenres());
        assertEquals(2, result.getReleases().get(0).getBasicInformation().getGenres().size());
        assertTrue(result.getReleases().get(0).getBasicInformation().getGenres().contains("Rock"));
    }

    @Test
    void getRandomRecord_WithGenreFilter() {
        com.antigravity.vinyltracker.model.Record r1 = new com.antigravity.vinyltracker.model.Record();
        r1.setDiscogsId(101L);
        r1.setTitle("Jazz Album");
        r1.setArtist("Miles Davis");
        r1.setGenres(List.of("Jazz"));

        com.antigravity.vinyltracker.model.Record r2 = new com.antigravity.vinyltracker.model.Record();
        r2.setDiscogsId(102L);
        r2.setTitle("Rock Album");
        r2.setArtist("Led Zeppelin");
        r2.setGenres(List.of("Rock"));

        com.antigravity.vinyltracker.model.CollectionItem item1 = new com.antigravity.vinyltracker.model.CollectionItem(user, r1, 1L);
        com.antigravity.vinyltracker.model.CollectionItem item2 = new com.antigravity.vinyltracker.model.CollectionItem(user, r2, 2L);

        Mockito.when(collectionItemRepository.findCandidatesForRandom(user, false))
                .thenReturn(List.of(item1, item2));
        Mockito.when(listenEventRepository.countByRecordAndUser(r1, user)).thenReturn(3L);

        DiscogsDto.CollectionRelease result = collectionQueryService.getRandomRecord(user, "jazz", false);

        assertNotNull(result);
        assertEquals(101L, result.getId());
        assertEquals(3L, result.getListenCount());
    }

    @Test
    void getRandomRecord_NoCandidates_ReturnsNull() {
        Mockito.when(collectionItemRepository.findCandidatesForRandom(user, true))
                .thenReturn(List.of());

        DiscogsDto.CollectionRelease result = collectionQueryService.getRandomRecord(user, null, true);
        assertNull(result);
    }

    @Test
    void getUnplayedCollection_Success() {
        com.antigravity.vinyltracker.model.Record r1 = new com.antigravity.vinyltracker.model.Record();
        r1.setDiscogsId(201L);
        r1.setTitle("Unplayed Vinyl");
        r1.setArtist("Artist");
        com.antigravity.vinyltracker.model.CollectionItem item = new com.antigravity.vinyltracker.model.CollectionItem(user, r1, 5L);

        Page<com.antigravity.vinyltracker.model.CollectionItem> page = new PageImpl<>(List.of(item));
        Mockito.when(collectionItemRepository.findUnplayedByUser(Mockito.eq(user), Mockito.any(Pageable.class)))
                .thenReturn(page);

        DiscogsDto.CollectionResponse response = collectionQueryService.getUnplayedCollection(user, 1, 10);

        assertNotNull(response);
        assertEquals(1, response.getReleases().size());
        assertEquals(201L, response.getReleases().get(0).getId());
        assertEquals(0L, response.getReleases().get(0).getListenCount());
    }

    @Test
    void getCollection_ShouldSortByYearThenArtist_WhenSortIsYear() {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        Mockito.when(collectionItemRepository.findAllByUser(Mockito.eq(user), captor.capture()))
                .thenReturn(new PageImpl<>(List.of()));

        collectionQueryService.getCollection(user, 1, 20, "year", "asc", null, null);

        Pageable captured = captor.getValue();
        assertNotNull(captured.getSort());
        List<Sort.Order> orders = captured.getSort().stream().toList();
        assertEquals(3, orders.size());
        assertEquals("record.year", orders.get(0).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(0).getDirection());
        assertEquals("record.artist", orders.get(1).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(1).getDirection());
        assertEquals("record.title", orders.get(2).getProperty());
    }

    @Test
    void getCollection_ShouldSortByArtistThenYearAsc_WhenSortIsArtistDesc() {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        Mockito.when(collectionItemRepository.findAllByUser(Mockito.eq(user), captor.capture()))
                .thenReturn(new PageImpl<>(List.of()));

        collectionQueryService.getCollection(user, 1, 20, "artist", "desc", null, null);

        Pageable captured = captor.getValue();
        assertNotNull(captured.getSort());
        List<Sort.Order> orders = captured.getSort().stream().toList();
        assertEquals(3, orders.size());
        assertEquals("record.artist", orders.get(0).getProperty());
        assertEquals(Sort.Direction.DESC, orders.get(0).getDirection());
        assertEquals("record.year", orders.get(1).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(1).getDirection());
        assertEquals("record.title", orders.get(2).getProperty());
    }

    @Test
    void getCollection_ShouldSortByFormatThenArtistThenYear_WhenSortIsFormat() {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        Mockito.when(collectionItemRepository.findAllByUser(Mockito.eq(user), captor.capture()))
                .thenReturn(new PageImpl<>(List.of()));

        collectionQueryService.getCollection(user, 1, 20, "format", "asc", null, null);

        Pageable captured = captor.getValue();
        assertNotNull(captured.getSort());
        List<Sort.Order> orders = captured.getSort().stream().toList();
        assertEquals(4, orders.size());
        assertEquals("record.format", orders.get(0).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(0).getDirection());
        assertEquals("record.artist", orders.get(1).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(1).getDirection());
        assertEquals("record.year", orders.get(2).getProperty());
        assertEquals(Sort.Direction.ASC, orders.get(2).getDirection());
        assertEquals("record.title", orders.get(3).getProperty());
    }
}

