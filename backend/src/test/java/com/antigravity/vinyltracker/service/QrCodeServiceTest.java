package com.antigravity.vinyltracker.service;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.io.IOException;

class QrCodeServiceTest {

    private final QrCodeService qrCodeService = new QrCodeService();

    @Test
    void testGenerateQrCodeImage() throws IOException {
        String testText = "discogs-id:123456";
        byte[] image = qrCodeService.generateQrCodeImage(testText, 200, 200);

        Assertions.assertNotNull(image);
        Assertions.assertTrue(image.length > 0);

        // Check PNG signature
        Assertions.assertEquals((byte) 0x89, image[0]);
        Assertions.assertEquals((byte) 0x50, image[1]); // P
        Assertions.assertEquals((byte) 0x4E, image[2]); // N
        Assertions.assertEquals((byte) 0x47, image[3]); // G
    }
}
