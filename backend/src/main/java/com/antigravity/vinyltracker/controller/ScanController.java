package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.service.ScanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/scan")
@lombok.RequiredArgsConstructor
public class ScanController {

    private final ScanService scanService;

    @PostMapping
    public ResponseEntity<ScanDto.Result> scanBarcode(
            @RequestBody ScanDto.Request request,
            Principal principal) {
        ScanDto.Result result = scanService.processScan(request.getBarcode(), principal.getName());
        if (result.isSuccess() || (result.getDiscogsMatches() != null && !result.getDiscogsMatches().isEmpty())) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScan(
            @PathVariable Long id,
            Principal principal) {
        try {
            scanService.deleteScan(id, principal.getName());
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/all")
    public ResponseEntity<ScanDto.ResetResult> resetAllListens(Principal principal) {
        try {
            long deletedCount = scanService.resetAllListens(principal.getName());
            return ResponseEntity.ok(new ScanDto.ResetResult(true, "All listens have been reset", deletedCount));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
