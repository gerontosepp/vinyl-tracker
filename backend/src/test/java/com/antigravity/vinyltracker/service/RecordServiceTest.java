package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.RecordDetailDto;
import com.antigravity.vinyltracker.model.dto.UpdateConditionRequestDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordServiceTest {

    @Mock
    private RecordRepository recordRepository;

    @Mock
    private CollectionItemRepository collectionItemRepository;

    @Mock
    private ListenEventRepository listenEventRepository;

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private DiscogsApiClient discogsApiClient;

    @InjectMocks
    private RecordService recordService;

    private AppUser user;

    @BeforeEach
    void setUp() {
        user = new AppUser();
        user.setUsername("testuser");
    }

    @Test
    void getRecordDetails_Success_WithLocalRecordAndDiscogsRelease() {
        Record record = new Record();
        record.setId(1L);
        record.setDiscogsId(12345L);
        record.setTitle("Local Title");
        record.setArtist("Local Artist");
        record.setYear("1977");
        record.setThumbUrl("thumb.jpg");
        record.setGenres(List.of("Rock"));

        DiscogsDto.Release release = new DiscogsDto.Release();
        release.setId(12345L);
        release.setTitle("Discogs Title");
        release.setArtists(List.of(new DiscogsDto.Artist("Discogs Artist")));
        release.setYear(1977);
        release.setThumbUrl("discogs_thumb.jpg");
        release.setGenres(List.of("Classic Rock"));
        release.setNotes("Album notes");
        release.setCountry("UK");
        release.setReleased("1977-05-01");
        release.setLowestPrice(BigDecimal.valueOf(15.50));
        release.setNumForSale(3);

        DiscogsDto.Track track = new DiscogsDto.Track();
        track.setPosition("A1");
        track.setTitle("Track 1");
        release.setTracklist(List.of(track));

        CollectionItem item = new CollectionItem(user, record, 9999L);
        item.setMediaCondition("Near Mint (NM or M-)");
        item.setSleeveCondition("Very Good Plus (VG+)");
        ListenEvent listen = new ListenEvent(user, record);
        LocalDateTime now = LocalDateTime.now();
        listen.setTimestamp(now);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(discogsApiClient.getRelease(12345L, user)).thenReturn(release);
        when(collectionItemRepository.findByUserAndRecord(user, record)).thenReturn(Optional.of(item));
        when(listenEventRepository.countByRecordAndUser(record, user)).thenReturn(7L);
        when(listenEventRepository.findFirstByRecordAndUserOrderByTimestampDesc(record, user)).thenReturn(Optional.of(listen));
        when(listenEventRepository.findAllByRecordAndUserOrderByTimestampDesc(record, user)).thenReturn(List.of(listen));

        RecordDetailDto details = recordService.getRecordDetails(1L, "testuser");

        assertNotNull(details);
        assertEquals(1L, details.getId());
        assertEquals(12345L, details.getDiscogsId());
        assertEquals("Discogs Title", details.getTitle());
        assertEquals("Discogs Artist", details.getArtist());
        assertEquals("1977", details.getYear());
        assertTrue(details.isInCollection());
        assertEquals(9999L, details.getInstanceId());
        assertEquals(7L, details.getListenCount());
        assertEquals("LP", details.getFormat());
        assertEquals(now, details.getLastListenedAt());
        assertEquals(BigDecimal.valueOf(15.50), details.getLowestPrice());
        assertEquals(3, details.getNumForSale());
        assertNotNull(details.getAddedAt());
        assertEquals("Near Mint (NM or M-)", details.getMediaCondition());
        assertEquals("Very Good Plus (VG+)", details.getSleeveCondition());
        assertEquals(1, details.getListenHistory().size());
        assertEquals(1, details.getTracklist().size());
        assertEquals("Track 1", details.getTracklist().get(0).getTitle());
        assertEquals("Album notes", details.getNotes());
    }

    @Test
    void getRecordDetails_Success_DiscogsOnly_NotInDb() {
        DiscogsDto.Release release = new DiscogsDto.Release();
        release.setId(54321L);
        release.setTitle("Only on Discogs");
        release.setArtists(List.of(new DiscogsDto.Artist("Indie Artist")));
        release.setYear(2020);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(54321L)).thenReturn(Optional.empty());
        when(recordRepository.findByDiscogsId(54321L)).thenReturn(Optional.empty());
        when(discogsApiClient.getRelease(54321L, user)).thenReturn(release);
        when(collectionItemRepository.findByUserAndRecord_DiscogsId(user, 54321L)).thenReturn(Optional.empty());

        RecordDetailDto details = recordService.getRecordDetails(54321L, "testuser");

        assertNotNull(details);
        assertNull(details.getId());
        assertEquals(54321L, details.getDiscogsId());
        assertEquals("Only on Discogs", details.getTitle());
        assertFalse(details.isInCollection());
        assertEquals(0L, details.getListenCount());
    }

    @Test
    void getRecordDetails_NotFound() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(999L)).thenReturn(Optional.empty());
        when(recordRepository.findByDiscogsId(999L)).thenReturn(Optional.empty());
        when(discogsApiClient.getRelease(999L, user)).thenThrow(new RuntimeException("Discogs 404"));

        assertThrows(ResourceNotFoundException.class, () -> recordService.getRecordDetails(999L, "testuser"));
    }

    @Test
    void getRecordDetails_UserNotFound() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> recordService.getRecordDetails(1L, "unknown"));
    }

    @Test
    void logListen_Success() {
        Record record = new Record();
        record.setId(1L);
        record.setDiscogsId(12345L);
        record.setTitle("Local Title");
        record.setArtist("Local Artist");

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(listenEventRepository.save(any(ListenEvent.class))).thenAnswer(i -> i.getArgument(0));

        RecordDetailDto details = recordService.logListen(1L, "testuser");

        assertNotNull(details);
        verify(listenEventRepository).save(any(ListenEvent.class));
    }

    @Test
    void getRecordDetails_FetchesAndSavesMedianPriceWhenNull() {
        Record record = new Record();
        record.setId(2L);
        record.setDiscogsId(55555L);
        record.setTitle("Test Title");
        record.setArtist("Test Artist");

        DiscogsDto.Release release = new DiscogsDto.Release();
        release.setId(55555L);
        release.setTitle("Test Title");

        CollectionItem item = new CollectionItem(user, record, 8888L);
        item.setMediaCondition("Very Good (VG)");

        Map<String, DiscogsDto.PriceSuggestion> suggestions = Map.of(
                "Very Good (VG)", new DiscogsDto.PriceSuggestion("EUR", 14.50),
                "Very Good Plus (VG+)", new DiscogsDto.PriceSuggestion("EUR", 20.00)
        );

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(2L)).thenReturn(Optional.of(record));
        when(discogsApiClient.getRelease(55555L, user)).thenReturn(release);
        when(collectionItemRepository.findByUserAndRecord(user, record)).thenReturn(Optional.of(item));
        when(discogsApiClient.getPriceSuggestions(55555L, user)).thenReturn(suggestions);

        RecordDetailDto details = recordService.getRecordDetails(2L, "testuser");

        assertNotNull(details);
        assertEquals(new BigDecimal("14.50"), details.getMedianPrice());
        assertEquals(new BigDecimal("14.50"), record.getMedianPrice());
        verify(recordRepository).save(record);
    }

    @Test
    void updateCondition_Success_UpdatesConditionRecalculatesPriceAndSyncsToDiscogs() {
        user.setDiscogsToken("encrypted-token");
        user.setDiscogsUsername("discogsUser");

        Record record = new Record();
        record.setId(3L);
        record.setDiscogsId(99999L);
        record.setTitle("Test Title");
        record.setArtist("Test Artist");

        CollectionItem item = new CollectionItem(user, record, 7777L);
        item.setMediaCondition("Very Good (VG)");
        item.setSleeveCondition("Good (G)");

        DiscogsDto.Release release = new DiscogsDto.Release();
        release.setId(99999L);
        release.setTitle("Test Title");

        Map<String, DiscogsDto.PriceSuggestion> suggestions = Map.of(
                "Mint (M)", new DiscogsDto.PriceSuggestion("EUR", 35.00),
                "Near Mint (NM or M-)", new DiscogsDto.PriceSuggestion("EUR", 28.00)
        );

        DiscogsDto.CollectionFieldsResponse fieldsResponse = new DiscogsDto.CollectionFieldsResponse(List.of(
                new DiscogsDto.CollectionField(10L, "Media Condition", "dropdown", List.of(), 1),
                new DiscogsDto.CollectionField(20L, "Sleeve Condition", "dropdown", List.of(), 2)
        ));

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(3L)).thenReturn(Optional.of(record));
        when(collectionItemRepository.findByUserAndRecord(user, record)).thenReturn(Optional.of(item));
        when(discogsApiClient.getRelease(99999L, user)).thenReturn(release);
        when(discogsApiClient.getPriceSuggestions(99999L, user)).thenReturn(suggestions);
        when(discogsApiClient.getCollectionFields(user)).thenReturn(fieldsResponse);

        UpdateConditionRequestDto request = UpdateConditionRequestDto.builder()
                .mediaCondition("Mint (M)")
                .sleeveCondition("Near Mint (NM or M-)")
                .build();

        RecordDetailDto result = recordService.updateCondition(3L, request, "testuser");

        assertNotNull(result);
        assertEquals("Mint (M)", item.getMediaCondition());
        assertEquals("Near Mint (NM or M-)", item.getSleeveCondition());
        assertEquals(new BigDecimal("35.00"), record.getMedianPrice());
        verify(collectionItemRepository).save(item);
        verify(recordRepository).save(record);
        verify(discogsApiClient).updateInstanceField(user, 99999L, 7777L, 10L, "Mint (M)");
        verify(discogsApiClient).updateInstanceField(user, 99999L, 7777L, 20L, "Near Mint (NM or M-)");
    }

    @Test
    void updateCondition_RecordNotFound() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(999L)).thenReturn(Optional.empty());
        when(recordRepository.findByDiscogsId(999L)).thenReturn(Optional.empty());

        UpdateConditionRequestDto request = UpdateConditionRequestDto.builder()
                .mediaCondition("Mint (M)")
                .build();

        assertThrows(ResourceNotFoundException.class, () ->
                recordService.updateCondition(999L, request, "testuser"));
    }

    @Test
    void updateCondition_ItemNotInCollection() {
        Record record = new Record();
        record.setId(4L);
        record.setDiscogsId(44444L);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(4L)).thenReturn(Optional.of(record));
        when(collectionItemRepository.findByUserAndRecord(user, record)).thenReturn(Optional.empty());
        when(collectionItemRepository.findByUserAndRecord_DiscogsId(user, 44444L)).thenReturn(Optional.empty());

        UpdateConditionRequestDto request = UpdateConditionRequestDto.builder()
                .mediaCondition("Mint (M)")
                .build();

        assertThrows(ResourceNotFoundException.class, () ->
                recordService.updateCondition(4L, request, "testuser"));
    }
}

