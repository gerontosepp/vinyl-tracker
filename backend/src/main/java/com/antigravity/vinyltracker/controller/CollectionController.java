package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.service.CollectionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

import java.io.IOException;

@RestController
@RequestMapping("/api/collection")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

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

    @PostMapping("/sync")
    public ResponseEntity<com.antigravity.vinyltracker.model.dto.SyncResultDto> forceSyncCollection(
            Principal principal) {
        com.antigravity.vinyltracker.model.dto.SyncResultDto result = collectionService.forceSync(principal.getName());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/qr-codes/selected")
    public ResponseEntity<byte[]> generateSelectedQrCodes(@RequestBody DiscogsDto.QrCodeRequest request) {
        try {
            byte[] pdfBytes = collectionService.generateSelectedQrCodesPdf(request);
            return createPdfResponse(pdfBytes);
        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF", e);
        }
    }

    @GetMapping("/qr-codes/all")
    public ResponseEntity<byte[]> generateAllQrCodes(Principal principal) {
        try {
            byte[] pdfBytes = collectionService.generateAllQrCodesPdf(principal.getName());
            return createPdfResponse(pdfBytes);
        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF", e);
        }
    }

    private ResponseEntity<byte[]> createPdfResponse(byte[] pdfBytes) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
}
