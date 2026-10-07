package com.antigravity.vinyltracker.controller;
 
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.security.Principal;
import java.util.List;
import java.util.Map;
 
@RestController
@RequestMapping("/api/analytics")
@lombok.RequiredArgsConstructor
public class AnalyticsController {
 
    private final AnalyticsService analyticsService;
 
    @GetMapping("/recent")
    public ResponseEntity<List<com.antigravity.vinyltracker.model.dto.ListenEventDto>> getRecentListens(
            Principal principal,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noCache().noStore().mustRevalidate())
                .body(analyticsService.getRecentListens(principal.getName(), from, to));
    }
 
    @GetMapping("/top")
    public ResponseEntity<List<TopRecordDto>> getTopRecords(
            Principal principal,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noCache().noStore().mustRevalidate())
                .body(analyticsService.getTopRecords(principal.getName(), from, to));
    }
 
    @GetMapping("/collection/value")
    public ResponseEntity<DiscogsDto.ValueResponse> getCollectionValue(Principal principal) {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noCache().noStore().mustRevalidate())
                .body(analyticsService.getCollectionValue(principal.getName()));
    }
 
    @GetMapping("/collection/genres")
    public ResponseEntity<List<Map<String, Object>>> getGenreBreakdown(Principal principal) {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noCache().noStore().mustRevalidate())
                .body(analyticsService.getGenreBreakdown(principal.getName()));
    }
}

