package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.service.CollectionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/collection")
@lombok.RequiredArgsConstructor
public class CollectionController {

    private final CollectionService collectionService;

    @GetMapping
    public ResponseEntity<DiscogsDto.CollectionResponse> getCollection(
            Principal principal,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int per_page,
            @RequestParam(defaultValue = "artist") String sort,
            @RequestParam(defaultValue = "asc") String sort_order,
            @RequestParam(required = false) Integer min_plays,
            @RequestParam(required = false) String search) {

        return ResponseEntity
                .ok(collectionService.getCollection(principal.getName(), page, per_page, sort, sort_order, min_plays,
                        search));
    }

    @GetMapping("/random")
    public ResponseEntity<DiscogsDto.CollectionRelease> getRandomRecord(
            Principal principal,
            @RequestParam(required = false) String genre,
            @RequestParam(value = "unplayed_only", defaultValue = "false") boolean unplayedOnly) {
        DiscogsDto.CollectionRelease release = collectionService.getRandomRecord(principal.getName(), genre, unplayedOnly);
        if (release == null) {
            throw new com.antigravity.vinyltracker.exception.ResourceNotFoundException("No records found matching the specified criteria");
        }
        return ResponseEntity.ok(release);
    }

    @GetMapping("/unplayed")
    public ResponseEntity<DiscogsDto.CollectionResponse> getUnplayedCollection(
            Principal principal,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int per_page) {
        return ResponseEntity.ok(collectionService.getUnplayedCollection(principal.getName(), page, per_page));
    }

    @PostMapping("/sync")
    public ResponseEntity<com.antigravity.vinyltracker.model.dto.SyncResultDto> forceSyncCollection(
            Principal principal) {
        com.antigravity.vinyltracker.model.dto.SyncResultDto result = collectionService.forceSync(principal.getName());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/releases/{releaseId}")
    public ResponseEntity<com.antigravity.vinyltracker.model.dto.SyncResultDto> addReleaseToCollection(
            Principal principal,
            @PathVariable Long releaseId) {
        com.antigravity.vinyltracker.model.dto.SyncResultDto result = collectionService.addReleaseAndSync(principal.getName(), releaseId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/qr-codes/selected")
    public ResponseEntity<byte[]> generateSelectedQrCodes(@jakarta.validation.Valid @RequestBody DiscogsDto.QrCodeRequest request) {
        byte[] pdfBytes = collectionService.generateSelectedQrCodesPdf(request);
        return createPdfResponse(pdfBytes);
    }

    @GetMapping("/qr-codes/all")
    public ResponseEntity<byte[]> generateAllQrCodes(Principal principal) {
        byte[] pdfBytes = collectionService.generateAllQrCodesPdf(principal.getName());
        return createPdfResponse(pdfBytes);
    }

    private ResponseEntity<byte[]> createPdfResponse(byte[] pdfBytes) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
}
