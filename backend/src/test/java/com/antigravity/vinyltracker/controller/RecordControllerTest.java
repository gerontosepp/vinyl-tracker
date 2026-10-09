package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.dto.RecordDetailDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.security.JwtService;
import com.antigravity.vinyltracker.service.RecordService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RecordController.class)
class RecordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RecordService recordService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AuthCookieService authCookieService;

    @Test
    @WithMockUser(username = "testuser")
    void getRecordDetails_Success() throws Exception {
        RecordDetailDto detail = RecordDetailDto.builder()
                .id(1L)
                .discogsId(999L)
                .title("Dark Side of the Moon")
                .artist("Pink Floyd")
                .inCollection(true)
                .listenCount(5L)
                .build();

        when(recordService.getRecordDetails(1L, "testuser")).thenReturn(detail);

        mockMvc.perform(get("/api/records/1")
                        .principal(() -> "testuser")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.discogs_id").value(999))
                .andExpect(jsonPath("$.title").value("Dark Side of the Moon"))
                .andExpect(jsonPath("$.artist").value("Pink Floyd"))
                .andExpect(jsonPath("$.in_collection").value(true))
                .andExpect(jsonPath("$.listen_count").value(5));
    }

    @Test
    @WithMockUser(username = "testuser")
    void getRecordDetails_NotFound() throws Exception {
        when(recordService.getRecordDetails(999L, "testuser"))
                .thenThrow(new ResourceNotFoundException("Record not found with ID: 999"));

        mockMvc.perform(get("/api/records/999")
                        .principal(() -> "testuser")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType("application/problem+json"));
    }

    @Test
    @WithMockUser(username = "testuser")
    void logListen_Success() throws Exception {
        RecordDetailDto detail = RecordDetailDto.builder()
                .id(1L)
                .discogsId(999L)
                .title("Dark Side of the Moon")
                .artist("Pink Floyd")
                .inCollection(true)
                .listenCount(6L)
                .build();

        when(recordService.logListen(1L, "testuser")).thenReturn(detail);

        mockMvc.perform(post("/api/records/1/listen")
                        .with(csrf())
                        .principal(() -> "testuser")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.listen_count").value(6));
    }
}
