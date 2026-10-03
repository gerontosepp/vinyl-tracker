package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.security.JwtService;
import com.antigravity.vinyltracker.service.DiscogsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DiscogsController.class)
class DiscogsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DiscogsService discogsService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AuthCookieService authCookieService;

    @Test
    @WithMockUser(username = "testuser")
    void search_SuccessWithQueryParam() throws Exception {
        DiscogsDto.SearchResponse response = new DiscogsDto.SearchResponse();
        DiscogsDto.SearchResult result = new DiscogsDto.SearchResult();
        result.setId(12345L);
        result.setTitle("Abbey Road");
        response.setResults(List.of(result));

        when(discogsService.search("Abbey Road", "release", 1, 50, "testuser"))
                .thenReturn(response);

        mockMvc.perform(get("/api/discogs/search")
                        .principal(() -> "testuser")
                        .param("query", "Abbey Road")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].id").value(12345))
                .andExpect(jsonPath("$.results[0].title").value("Abbey Road"));
    }

    @Test
    @WithMockUser(username = "testuser")
    void search_SuccessWithQParam() throws Exception {
        DiscogsDto.SearchResponse response = new DiscogsDto.SearchResponse();
        DiscogsDto.SearchResult result = new DiscogsDto.SearchResult();
        result.setId(54321L);
        result.setTitle("Help!");
        response.setResults(List.of(result));

        when(discogsService.search("Help!", "release", 2, 20, "testuser"))
                .thenReturn(response);

        mockMvc.perform(get("/api/discogs/search")
                        .principal(() -> "testuser")
                        .param("q", "Help!")
                        .param("page", "2")
                        .param("per_page", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].id").value(54321));
    }

    @Test
    @WithMockUser(username = "testuser")
    void search_MissingQuery_BadRequest() throws Exception {
        mockMvc.perform(get("/api/discogs/search")
                        .principal(() -> "testuser")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }
}
