package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScanServiceTest {

    @Mock
    private DiscogsService discogsService;

    @Mock
    private RecordRepository recordRepository;

    @Mock
    private ListenEventRepository listenEventRepository;

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private ScanService scanService;

    private AppUser user;

    @BeforeEach
    void setUp() {
        user = new AppUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setDiscogsUsername("testdiscogs");
    }

    @Test
    void processScan_ShouldReturnSuccess_WhenBarcodeIsFoundInCollection() {
        String barcode = "123456789";
        String username = "testuser";
        Long releaseId = 12345L;

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);
        mockRelease.setTitle("Test Title");
        mockRelease.setArtists(java.util.List.of(new DiscogsDto.Artist("Test Artist"))); // Assuming Artist constructor
                                                                                         // or setter
        mockRelease.setYear(2022);
        mockRelease.setThumbUrl("http://thumb.url");

        when(discogsService.searchCollectionByBarcode(barcode, user)).thenReturn(mockRelease);

        // Mock Record Repository to return existing or save new
        when(recordRepository.findByDiscogsId(releaseId)).thenReturn(Optional.empty());
        when(recordRepository.save(any(Record.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertTrue(result.isSuccess());
        assertEquals("Now playing: Test Title", result.getMessage());
        assertNotNull(result.getRecord());
        assertEquals("Test Title", result.getRecord().getTitle());

        verify(listenEventRepository).save(any(ListenEvent.class));
    }

    @Test
    void processScan_ShouldReturnFailure_WhenReleaseNotFound() {
        String barcode = "999999999";
        String username = "testuser";

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(discogsService.searchCollectionByBarcode(barcode, user)).thenReturn(null);

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertFalse(result.isSuccess());
        assertEquals("Release not found in collection or invalid barcode.", result.getMessage());
        verify(listenEventRepository, never()).save(any(ListenEvent.class));
    }

    @Test
    void processScan_ShouldHandleCustomCode() {
        String barcode = "discogs-id:12345";
        String username = "testuser";
        Long releaseId = 12345L;

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);
        mockRelease.setTitle("Custom Code Release");
        mockRelease.setYear(2020);

        when(discogsService.getRelease(releaseId, user)).thenReturn(mockRelease);
        when(recordRepository.findByDiscogsId(releaseId)).thenReturn(Optional.empty());
        when(recordRepository.save(any(Record.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertTrue(result.isSuccess());
        assertEquals("Now playing: Custom Code Release", result.getMessage());
    }
}
