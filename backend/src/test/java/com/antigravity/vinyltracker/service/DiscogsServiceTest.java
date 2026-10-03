package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DiscogsServiceTest {

    @Mock
    private DiscogsApiClient discogsApiClient;

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private DiscogsService discogsService;

    private AppUser user;

    @BeforeEach
    void setUp() {
        user = new AppUser();
        user.setUsername("testuser");
    }

    @Test
    void search_Success() {
        DiscogsDto.SearchResponse response = new DiscogsDto.SearchResponse();
        DiscogsDto.SearchResult item = new DiscogsDto.SearchResult();
        item.setId(12345L);
        response.setResults(List.of(item));

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(discogsApiClient.searchDatabase("Pink Floyd", "release", 1, 20, user)).thenReturn(response);

        DiscogsDto.SearchResponse result = discogsService.search("Pink Floyd", "release", 1, 20, "testuser");

        assertNotNull(result);
        assertEquals(1, result.getResults().size());
        assertEquals(12345L, result.getResults().get(0).getId());
    }

    @Test
    void search_UserNotFound() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> discogsService.search("Pink Floyd", "release", 1, 20, "unknown"));
    }
}
