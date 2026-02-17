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

    @GetMapping
    public ResponseEntity<DiscogsDto.CollectionResponse> getCollection(
            @RequestParam String username,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int per_page) {

        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        return ResponseEntity.ok(discogsService.getCollection(user, page, per_page));
    }

    @PostMapping("/qr-codes/selected")
    public ResponseEntity<byte[]> generateSelectedQrCodes(@RequestBody DiscogsDto.QrCodeRequest request) {
        try {
            byte[] pdfBytes = pdfService.generateQrCodePdf(request.getItems());
            return createPdfResponse(pdfBytes);
        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF", e);
        }
    }

    @GetMapping("/qr-codes/all")
    public ResponseEntity<byte[]> generateAllQrCodes(@RequestParam String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        try {
            List<DiscogsDto.CollectionRelease> releases = discogsService.getAllCollection(user);
            List<DiscogsDto.QrCodeItem> items = releases.stream().map(this::mapToQrItem).sorted((a, b) -> {
                String artist1 = a.getArtist() != null ? a.getArtist() : "";
                String artist2 = b.getArtist() != null ? b.getArtist() : "";
                return artist1.compareToIgnoreCase(artist2);
            }).toList();

            byte[] pdfBytes = pdfService.generateQrCodePdf(items);
            return createPdfResponse(pdfBytes);

        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF", e);
        }
    }

    private DiscogsDto.QrCodeItem mapToQrItem(DiscogsDto.CollectionRelease release) {
        String artist = "Unknown";
        if (release.getBasicInformation().getArtists() != null
                && !release.getBasicInformation().getArtists().isEmpty()) {
            artist = release.getBasicInformation().getArtists().get(0).getName();
        }
        return new DiscogsDto.QrCodeItem(release.getId(), release.getBasicInformation().getTitle(), artist);
    }

    private ResponseEntity<byte[]> createPdfResponse(byte[] pdfBytes) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
}
