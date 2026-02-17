package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.service.ScanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scan")
public class ScanController {

    private final ScanService scanService;

    public ScanController(ScanService scanService) {
        this.scanService = scanService;
    }

    @PostMapping
    public ResponseEntity<ScanDto.Result> scanBarcode(
            @RequestBody ScanDto.Request request,
            @RequestParam String username // Simple auth for MVP
    ) {
        ScanDto.Result result = scanService.processScan(request.getBarcode(), username);
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScan(
            @PathVariable Long id,
            @RequestParam String username) {
        try {
            scanService.deleteScan(id, username);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
