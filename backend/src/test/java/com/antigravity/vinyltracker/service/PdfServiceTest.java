package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class PdfServiceTest {

    @Test
    void testGenerateQrCodePdf() throws IOException {
        QrCodeService qrCodeService = Mockito.mock(QrCodeService.class);
        // Return a valid minimal 1x1 pixel PNG
        byte[] mockPng = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // Header
                0x00, 0x00, 0x00, 0x0D, // IHDR start
                0x49, 0x48, 0x44, 0x52, // IHDR chunk type
                0x00, 0x00, 0x00, 0x01, // Width 1
                0x00, 0x00, 0x00, 0x01, // Height 1
                0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
                0x1F, 0x15, (byte) 0xC4, (byte) 0x89, // CRC
                0x00, 0x00, 0x00, 0x0A, // IDAT start
                0x49, 0x44, 0x41, 0x54, // IDAT chunk type
                0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
                0x0D, 0x0A, 0x2D, (byte) 0xB4, // CRC
                0x00, 0x00, 0x00, 0x00, // IEND start
                0x49, 0x45, 0x4E, 0x44, // IEND chunk type
                (byte) 0xAE, 0x42, 0x60, (byte) 0x82 // CRC
        };
        when(qrCodeService.generateQrCodeImage(anyString(), anyInt(), anyInt())).thenReturn(mockPng);

        PdfService pdfService = new PdfService(qrCodeService);

        DiscogsDto.BasicInformation basicInfo = new DiscogsDto.BasicInformation();
        basicInfo.setId(12345L);
        basicInfo.setTitle("Test Album");
        basicInfo.setArtists(Collections.singletonList(new DiscogsDto.Artist("Test Artist")));

        DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
        release.setId(12345L);
        release.setBasicInformation(basicInfo);

        List<DiscogsDto.CollectionRelease> releases = Collections.singletonList(release);

        byte[] pdfBytes = pdfService.generateQrCodePdf(releases);

        Assertions.assertNotNull(pdfBytes);
        Assertions.assertTrue(pdfBytes.length > 0);

        // Check PDF signature %PDF-
        Assertions.assertEquals((byte) '%', pdfBytes[0]);
        Assertions.assertEquals((byte) 'P', pdfBytes[1]);
        Assertions.assertEquals((byte) 'D', pdfBytes[2]);
        Assertions.assertEquals((byte) 'F', pdfBytes[3]);
        Assertions.assertEquals((byte) '-', pdfBytes[4]);
    }
}
