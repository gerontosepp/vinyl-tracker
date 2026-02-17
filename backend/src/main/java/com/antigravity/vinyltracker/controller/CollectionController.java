package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.DiscogsService;
import com.antigravity.vinyltracker.service.PdfService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/collection")
public class CollectionController {

    private final DiscogsService discogsService;
    private final PdfService pdfService;
    private final AppUserRepository userRepository;

    public CollectionController(DiscogsService discogsService, PdfService pdfService,
            AppUserRepository userRepository) {
        this.discogsService = discogsService;
        this.pdfService = pdfService;
        this.userRepository = userRepository;
    }

    @GetMapping("/qr-codes")
    public ResponseEntity<byte[]> generateQrCodes(@RequestParam String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        try {
            // For MVP, fetch first page (100 items). Pagination can be improved later.

            DiscogsDto.CollectionResponse response = discogsService.getCollection(user, 1);
            List<DiscogsDto.CollectionRelease> releases = response != null && response.getReleases() != null
                    ? new ArrayList<>(response.getReleases())
                    : new ArrayList<>();

            // Sort by Artist Name
            releases.sort((r1, r2) -> {
                String artist1 = r1.getBasicInformation().getArtists() != null
                        && !r1.getBasicInformation().getArtists().isEmpty()
                                ? r1.getBasicInformation().getArtists().get(0).getName()
                                : "";
                String artist2 = r2.getBasicInformation().getArtists() != null
                        && !r2.getBasicInformation().getArtists().isEmpty()
                                ? r2.getBasicInformation().getArtists().get(0).getName()
                                : "";
                return artist1.compareToIgnoreCase(artist2);
            });

            byte[] pdfBytes = pdfService.generateQrCodePdf(releases);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfBytes);

        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF", e);
        }
    }
}
