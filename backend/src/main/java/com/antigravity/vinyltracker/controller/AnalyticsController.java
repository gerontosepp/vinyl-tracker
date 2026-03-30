package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.time.Instant;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.service.DiscogsApiClient;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final DiscogsApiClient discogsApiClient;
    private final CollectionItemRepository collectionItemRepository;
    private final AppUserRepository userRepository;

    public AnalyticsController(AnalyticsService analyticsService, DiscogsApiClient discogsApiClient, CollectionItemRepository collectionItemRepository, AppUserRepository userRepository) {
        this.analyticsService = analyticsService;
        this.discogsApiClient = discogsApiClient;
        this.collectionItemRepository = collectionItemRepository;
        this.userRepository = userRepository;
    }

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
    public ResponseEntity<?> getCollectionValue(Principal principal) {
        AppUser user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null || user.getDiscogsToken() == null || user.getDiscogsToken().isEmpty()) {
            return ResponseEntity.badRequest().body(problem(
                    HttpStatus.BAD_REQUEST,
                    "Discogs not connected",
                    "Connect your Discogs account in settings before requesting collection value."));
        }

        try {
            DiscogsDto.ValueResponse valueResponse = discogsApiClient.getCollectionValue(user);
            return ResponseEntity.ok(valueResponse);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(problem(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Collection value unavailable",
                    "Failed to fetch collection value from Discogs."));
        }
    }

    @GetMapping("/collection/genres")
    public ResponseEntity<?> getGenreBreakdown(Principal principal) {
        AppUser user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(problem(
                    HttpStatus.BAD_REQUEST,
                    "User not found",
                    "Authenticated user could not be resolved for genre analytics."));
        }

        // Fetch all items from local DB
        List<com.antigravity.vinyltracker.model.CollectionItem> items = collectionItemRepository.findAllByUser(user);

        // Aggregate genres
        Map<String, Integer> genreCounts = new HashMap<>();
        for (com.antigravity.vinyltracker.model.CollectionItem item : items) {
            List<String> genres = item.getRecord().getGenres();
            if (genres != null && !genres.isEmpty()) {
                for (String genre : genres) {
                    genreCounts.put(genre, genreCounts.getOrDefault(genre, 0) + 1);
                }
            } else {
                genreCounts.put("Unknown", genreCounts.getOrDefault("Unknown", 0) + 1);
            }
        }

        List<Map<String, Object>> result = genreCounts.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue())) // Descending
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", entry.getKey());
                    map.put("value", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());

        if (result.size() > 5) {
            List<Map<String, Object>> top5 = new java.util.ArrayList<>(result.subList(0, 5));
            int otherCount = result.subList(5, result.size()).stream()
                    .mapToInt(m -> (Integer) m.get("value"))
                    .sum();
            
            if (otherCount > 0) {
               Map<String, Object> otherMap = new HashMap<>();
               otherMap.put("name", "Other");
               otherMap.put("value", otherCount);
               top5.add(otherMap);
            }
            return ResponseEntity.ok(top5);
        }

        return ResponseEntity.ok(result);
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(status);
        problemDetail.setTitle(title);
        problemDetail.setDetail(detail);
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return problemDetail;
    }
}
