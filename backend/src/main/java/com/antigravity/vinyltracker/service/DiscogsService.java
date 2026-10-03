package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiscogsService {

    private final DiscogsApiClient discogsApiClient;
    private final AppUserRepository userRepository;

    public DiscogsDto.SearchResponse search(String query, String type, int page, int perPage, String username) {
        log.info("Searching Discogs for query: {}, type: {}, page: {}, perPage: {}, user: {}", query, type, page, perPage, username);
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
        return discogsApiClient.searchDatabase(query, type, page, perPage, user);
    }
}
