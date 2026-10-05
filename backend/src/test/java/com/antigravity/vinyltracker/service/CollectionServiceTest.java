package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.SyncResultDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CollectionServiceTest {

    @Mock
    private CollectionQueryService collectionQueryService;

    @Mock
    private CollectionSyncService collectionSyncService;

    @Mock
    private PdfService pdfService;

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private CollectionService collectionService;

    private AppUser testUser;

    @BeforeEach
    void setUp() {
        testUser = new AppUser("testuser", "pw");
    }

    @Test
    void getCollection_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
        when(collectionQueryService.getCollection(testUser, 1, 50, "artist", "asc", 0, null)).thenReturn(mockResponse);

        DiscogsDto.CollectionResponse result = collectionService.getCollection("testuser", 1, 50, "artist", "asc", 0,
                null);
        assertEquals(mockResponse, result);
    }

    @Test
    void forceSync_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        SyncResultDto mockResult = new SyncResultDto(5, 2);
        when(collectionSyncService.syncCollection(testUser)).thenReturn(mockResult);

        SyncResultDto result = collectionService.forceSync("testuser");
        assertEquals(5, result.getAdded());
        assertEquals(2, result.getRemoved());
    }

    @Test
    void forceSync_UserNotFound() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> collectionService.forceSync("unknown"));
    }

    @Test
    void generateSelectedQrCodesPdf_Success() {
        DiscogsDto.QrCodeRequest req = new DiscogsDto.QrCodeRequest();
        req.setItems(List.of(new DiscogsDto.QrCodeItem(1L, "Title", "Artist")));

        byte[] pdfOutput = new byte[] { 1, 2, 3 };
        when(pdfService.generateQrCodePdf(any())).thenReturn(pdfOutput);

        byte[] result = collectionService.generateSelectedQrCodesPdf(req);
        assertArrayEquals(pdfOutput, result);
    }

    @Test
    void generateAllQrCodesPdf_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));

        DiscogsDto.CollectionRelease r1 = new DiscogsDto.CollectionRelease();
        r1.setId(10L);
        DiscogsDto.BasicInformation b1 = new DiscogsDto.BasicInformation();
        b1.setTitle("Z Record");
        b1.setArtists(List.of(new DiscogsDto.Artist("B Artist")));
        r1.setBasicInformation(b1);

        when(collectionQueryService.getAllCollection(testUser)).thenReturn(List.of(r1));

        byte[] pdfOutput = new byte[] { 4, 5, 6 };
        when(pdfService.generateQrCodePdf(any())).thenReturn(pdfOutput);

        byte[] result = collectionService.generateAllQrCodesPdf("testuser");
        assertArrayEquals(pdfOutput, result);
    }

    @Test
    void generateAllQrCodesPdf_UserNotFound() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> collectionService.generateAllQrCodesPdf("unknown"));
    }

    @Test
    void getRandomRecord_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        DiscogsDto.CollectionRelease mockRelease = new DiscogsDto.CollectionRelease();
        mockRelease.setId(42L);
        when(collectionQueryService.getRandomRecord(testUser, "Jazz", true)).thenReturn(mockRelease);

        DiscogsDto.CollectionRelease result = collectionService.getRandomRecord("testuser", "Jazz", true);
        assertEquals(mockRelease, result);
    }

    @Test
    void getUnplayedCollection_Success() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
        when(collectionQueryService.getUnplayedCollection(testUser, 1, 20)).thenReturn(mockResponse);

        DiscogsDto.CollectionResponse result = collectionService.getUnplayedCollection("testuser", 1, 20);
        assertEquals(mockResponse, result);
    }
}
