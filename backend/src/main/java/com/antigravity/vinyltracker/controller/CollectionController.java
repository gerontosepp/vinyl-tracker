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
import java.security.Principal;

import java.io.IOException;
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
            Principal principal,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int per_page,
            @RequestParam(defaultValue = "artist") String sort,
            @RequestParam(defaultValue = "asc") String sort_order,
            @RequestParam(required = false) Integer min_plays) {

        AppUser user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + principal.getName()));

        return ResponseEntity.ok(discogsService.getCollection(user, page, per_page, sort, sort_order, min_plays));
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
    public ResponseEntity<byte[]> generateAllQrCodes(Principal principal) {
        AppUser user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + principal.getName()));

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
