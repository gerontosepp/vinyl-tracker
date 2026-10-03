package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.service.DiscogsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/discogs")
@RequiredArgsConstructor
public class DiscogsController {

    private final DiscogsService discogsService;

    @GetMapping("/search")
    public ResponseEntity<DiscogsDto.SearchResponse> search(
            @RequestParam(value = "query", required = false) String queryParam,
            @RequestParam(value = "q", required = false) String qParam,
            @RequestParam(value = "type", required = false, defaultValue = "release") String type,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "per_page", defaultValue = "50") int perPage,
            Principal principal) {

        String query = queryParam != null && !queryParam.isBlank() ? queryParam : qParam;
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query parameter ('query' or 'q') is required");
        }

        DiscogsDto.SearchResponse response = discogsService.search(query, type, page, perPage, principal.getName());
        return ResponseEntity.ok(response);
    }
}
