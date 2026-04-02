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
    public List<ListenEvent> getRecentListens(
            Principal principal,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return analyticsService.getRecentListens(principal.getName(), from, to);
    }
 
    @GetMapping("/top")
    public List<TopRecordDto> getTopRecords(
            Principal principal,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return analyticsService.getTopRecords(principal.getName(), from, to);
    }
 
    @GetMapping("/collection/value")
    public ResponseEntity<DiscogsDto.ValueResponse> getCollectionValue(Principal principal) {
        return ResponseEntity.ok(analyticsService.getCollectionValue(principal.getName()));
    }
 
    @GetMapping("/collection/genres")
    public ResponseEntity<List<Map<String, Object>>> getGenreBreakdown(Principal principal) {
        return ResponseEntity.ok(analyticsService.getGenreBreakdown(principal.getName()));
    }
}

