package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AnalyticsServiceTest {

    @Mock
    private ListenEventRepository listenEventRepository;

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private AnalyticsService analyticsService;

    private AppUser testUser;
    private com.antigravity.vinyltracker.model.Record testRecord;
    private ListenEvent listenEvent;

    @BeforeEach
    void setUp() {
        testUser = new AppUser("testuser", "pw", "salt");
        testUser.setId(1L);

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

        List<ListenEvent> result = analyticsService.getRecentListens("testuser", null, null);
        assertEquals(1, result.size());
    }

    @Test
    void getRecentListens_WithDates() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                eq(1L), any(), any())).thenReturn(List.of(listenEvent));

        List<ListenEvent> result = analyticsService.getRecentListens("testuser", LocalDate.now(), LocalDate.now());
        assertEquals(1, result.size());
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
}
