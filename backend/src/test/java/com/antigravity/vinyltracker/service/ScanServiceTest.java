package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.ScanDto;
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

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ScanServiceTest {

    @Mock
    private DiscogsApiClient discogsApiClient;

    @Mock
    private RecordRepository recordRepository;

    @Mock
    private ListenEventRepository listenEventRepository;

    @Mock
    private CollectionItemRepository collectionItemRepository;

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
        user.setPassword("password");
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

        DiscogsDto.SearchResult mockSearchResult = new DiscogsDto.SearchResult();
        mockSearchResult.setId(releaseId);
        DiscogsDto.SearchResponse mockSearchResponse = new DiscogsDto.SearchResponse();
        mockSearchResponse.setResults(java.util.List.of(mockSearchResult));

        when(discogsApiClient.searchDatabaseByBarcode(barcode, user)).thenReturn(mockSearchResponse);
        when(discogsApiClient.isReleaseInCollection(releaseId, user)).thenReturn(true);
        when(discogsApiClient.getRelease(releaseId, user)).thenReturn(mockRelease);

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
        when(discogsApiClient.searchDatabaseByBarcode(barcode, user)).thenReturn(null);

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertFalse(result.isSuccess());
        assertEquals("Release not found in collection or invalid barcode.", result.getMessage());
        verify(listenEventRepository, never()).save(any(ListenEvent.class));
    }

    @Test
    void processScan_ShouldReturnDiscogsMatches_WhenBarcodeFoundOnDiscogsButNotInCollection() {
        String barcode = "555555555";
        String username = "testuser";
        Long releaseId = 99999L;

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        DiscogsDto.SearchResult mockSearchResult = new DiscogsDto.SearchResult();
        mockSearchResult.setId(releaseId);
        mockSearchResult.setTitle("Artist - Album");
        mockSearchResult.setYear("2024");
        mockSearchResult.setThumbUrl("http://thumb.url");
        mockSearchResult.setCoverImage("http://cover.url");
        mockSearchResult.setFormat(java.util.List.of("Vinyl", "LP"));
        mockSearchResult.setCountry("Germany");

        DiscogsDto.SearchResponse mockSearchResponse = new DiscogsDto.SearchResponse();
        mockSearchResponse.setResults(java.util.List.of(mockSearchResult));

        when(discogsApiClient.searchDatabaseByBarcode(barcode, user)).thenReturn(mockSearchResponse);
        when(discogsApiClient.isReleaseInCollection(releaseId, user)).thenReturn(false);

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertFalse(result.isSuccess());
        assertEquals("Release not found in collection, but found on Discogs.", result.getMessage());
        assertNotNull(result.getDiscogsMatches());
        assertEquals(1, result.getDiscogsMatches().size());
        assertEquals(releaseId, result.getDiscogsMatches().get(0).getId());
        assertEquals("Artist - Album", result.getDiscogsMatches().get(0).getTitle());
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

        when(discogsApiClient.getRelease(releaseId, user)).thenReturn(mockRelease);
        when(recordRepository.findByDiscogsId(releaseId)).thenReturn(Optional.empty());
        when(recordRepository.save(any(Record.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertTrue(result.isSuccess());
        assertEquals("Now playing: Custom Code Release", result.getMessage());
    }

    @Test
    void processScan_ShouldHandleCustomCode_WithGermanKeyboardSubstitution() {
        String barcode = "discogsßidÖ12345";
        String username = "testuser";
        Long releaseId = 12345L;

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        DiscogsDto.Release mockRelease = new DiscogsDto.Release();
        mockRelease.setId(releaseId);
        mockRelease.setTitle("Custom Code Release");
        mockRelease.setYear(2020);

        when(discogsApiClient.getRelease(releaseId, user)).thenReturn(mockRelease);
        when(recordRepository.findByDiscogsId(releaseId)).thenReturn(Optional.empty());
        when(recordRepository.save(any(Record.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScanDto.Result result = scanService.processScan(barcode, username);

        assertTrue(result.isSuccess());
        assertEquals("Now playing: Custom Code Release", result.getMessage());
    }

    @Test
    void processScan_ShouldReturnFailure_WhenCustomCodeIsInvalid() {
        String username = "testuser";

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        ScanDto.Result result = scanService.processScan("discogs-id:not-a-number", username);

        assertFalse(result.isSuccess());
        assertEquals("Invalid custom barcode format", result.getMessage());
        verifyNoInteractions(discogsApiClient);
        verify(recordRepository, never()).save(any(Record.class));
        verify(listenEventRepository, never()).save(any(ListenEvent.class));
    }

    @Test
    void processScan_ShouldThrow_WhenUserDoesNotExist() {
        when(userRepository.findByUsername("missing-user")).thenReturn(Optional.empty());

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> scanService.processScan("123456789", "missing-user"));

        assertEquals("User not found: missing-user", exception.getMessage());
        verifyNoInteractions(discogsApiClient, recordRepository, listenEventRepository);
    }

    @Test
    void deleteScan_ShouldDeleteEvent_WhenOwnedByCurrentUser() {
        ListenEvent event = new ListenEvent();
        event.setId(10L);
        event.setUser(user);

        when(listenEventRepository.findById(10L)).thenReturn(Optional.of(event));

        scanService.deleteScan(10L, "testuser");

        verify(listenEventRepository).delete(event);
    }

    @Test
    void deleteScan_ShouldThrow_WhenScanDoesNotExist() {
        when(listenEventRepository.findById(77L)).thenReturn(Optional.empty());

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> scanService.deleteScan(77L, "testuser"));

        assertEquals("Scan not found", exception.getMessage());
        verify(listenEventRepository, never()).delete(any(ListenEvent.class));
    }

    @Test
    void deleteScan_ShouldThrow_WhenScanBelongsToAnotherUser() {
        AppUser otherUser = new AppUser();
        otherUser.setUsername("someone-else");

        ListenEvent event = new ListenEvent();
        event.setId(11L);
        event.setUser(otherUser);

        when(listenEventRepository.findById(11L)).thenReturn(Optional.of(event));

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> scanService.deleteScan(11L, "testuser"));

        assertEquals("Unauthorized to delete this scan", exception.getMessage());
        verify(listenEventRepository, never()).delete(any(ListenEvent.class));
    }

    @Test
    void resetAllListens_ShouldDeleteAllListens_ForCurrentUser() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(listenEventRepository.deleteAllByUser(user)).thenReturn(5L);

        long result = scanService.resetAllListens("testuser");

        assertEquals(5L, result);
        verify(listenEventRepository).deleteAllByUser(user);
    }

    @Test
    void resetAllListens_ShouldThrow_WhenUserDoesNotExist() {
        when(userRepository.findByUsername("missing-user")).thenReturn(Optional.empty());

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> scanService.resetAllListens("missing-user"));

        assertEquals("User not found: missing-user", exception.getMessage());
        verify(listenEventRepository, never()).deleteAllByUser(any(AppUser.class));
    }
}
