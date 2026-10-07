package com.antigravity.vinyltracker.service;
 
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.exception.DiscogsTokenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
 
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
 
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
 
@ExtendWith(MockitoExtension.class)
public class AnalyticsServiceTest {
 
    @Mock
    private ListenEventRepository listenEventRepository;
 
    @Mock
    private AppUserRepository userRepository;
 
    @Mock
    private DiscogsApiClient discogsApiClient;
 
    @Mock
    private CollectionItemRepository collectionItemRepository;
 
    @InjectMocks
    private AnalyticsService analyticsService;
 
    private AppUser testUser;
    private com.antigravity.vinyltracker.model.Record testRecord;
    private ListenEvent listenEvent;
 
    @BeforeEach
    void setUp() {
        testUser = new AppUser("testuser", "pw");
        testUser.setId(1L);
        testUser.setDiscogsToken("valid_token");
 
        testRecord = new com.antigravity.vinyltracker.model.Record();
        testRecord.setId(100L);
        testRecord.setTitle("Test Title");
        testRecord.setArtist("Test Artist");
 
        listenEvent = new ListenEvent(testUser, testRecord);
        listenEvent.setTimestamp(LocalDateTime.now());
    }
 
    @Test
    void getRecentListens_NoDates() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(listenEventRepository.findByUserIdOrderByTimestampDesc(1L)).thenReturn(List.of(listenEvent));
 
        List<com.antigravity.vinyltracker.model.dto.ListenEventDto> result = analyticsService.getRecentListens("testuser", null, null);
        assertEquals(1, result.size());
        assertEquals("Test Title", result.get(0).getRecord().getTitle());
    }
 
    @Test
    void getRecentListens_WithDates() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                eq(1L), any(), any())).thenReturn(List.of(listenEvent));
 
        List<com.antigravity.vinyltracker.model.dto.ListenEventDto> result = analyticsService.getRecentListens("testuser", LocalDate.now(), LocalDate.now());
        assertEquals(1, result.size());
        assertEquals("Test Title", result.get(0).getRecord().getTitle());
    }
 
    @Test
    void getTopRecords_NoDates() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(listenEventRepository.findByUserIdOrderByTimestampDesc(1L)).thenReturn(List.of(listenEvent, listenEvent));
 
        List<TopRecordDto> result = analyticsService.getTopRecords("testuser", null, null);
        assertEquals(1, result.size());
        assertEquals("Test Title", result.get(0).getTitle());
        assertEquals(2L, result.get(0).getCount());
    }
 
    @Test
    void getTopRecords_WithDates() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                eq(1L), any(), any())).thenReturn(List.of(listenEvent));
 
        List<TopRecordDto> result = analyticsService.getTopRecords("testuser", LocalDate.now(), LocalDate.now());
        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).getCount());
    }
 
    @Test
    void getCollectionValue_Success() {
        DiscogsDto.ValueResponse expected = new DiscogsDto.ValueResponse(
                new DiscogsDto.ValueData("USD", 10.0),
                new DiscogsDto.ValueData("USD", 20.0),
                new DiscogsDto.ValueData("USD", 30.0)
        );
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(discogsApiClient.getCollectionValue(testUser)).thenReturn(expected);
 
        DiscogsDto.ValueResponse result = analyticsService.getCollectionValue("testuser");
        assertEquals(20.0, result.getMedian().getValue());
    }
 
    @Test
    void getCollectionValue_MissingToken() {
        testUser.setDiscogsToken(null);
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
 
        assertThrows(DiscogsTokenException.class, () -> analyticsService.getCollectionValue("testuser"));
    }
 
    @Test
    void getGenreBreakdown_Aggregation() {
        testRecord.setGenres(List.of("Rock", "Pop"));
        CollectionItem item = new CollectionItem(testUser, testRecord, 123L);
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(collectionItemRepository.findAllByUser(testUser)).thenReturn(List.of(item));
 
        List<Map<String, Object>> result = analyticsService.getGenreBreakdown("testuser");
        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(m -> m.get("name").equals("Rock") && m.get("value").equals(1)));
    }
}

