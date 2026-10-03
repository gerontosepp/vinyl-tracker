package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.RecordDetailDto;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
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

        DiscogsDto.Track track = new DiscogsDto.Track();
        track.setPosition("A1");
        track.setTitle("Track 1");
        release.setTracklist(List.of(track));

        CollectionItem item = new CollectionItem(user, record, 9999L);
        ListenEvent listen = new ListenEvent(user, record);
        LocalDateTime now = LocalDateTime.now();
        listen.setTimestamp(now);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(discogsApiClient.getRelease(12345L, user)).thenReturn(release);
        when(collectionItemRepository.findByUserAndRecord(user, record)).thenReturn(Optional.of(item));
        when(listenEventRepository.countByRecordAndUser(record, user)).thenReturn(7L);
        when(listenEventRepository.findFirstByRecordAndUserOrderByTimestampDesc(record, user)).thenReturn(Optional.of(listen));

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
        assertEquals(now, details.getLastListenedAt());
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
}
