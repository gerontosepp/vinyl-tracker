package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.service.AnalyticsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.security.Principal;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AnalyticsService analyticsService;

    @InjectMocks
    private AnalyticsController analyticsController;

    private Record record1;
    private Record record2;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(analyticsController).build();

        record1 = new Record();
        record1.setId(1L);
        record1.setTitle("Album One");

        record2 = new Record();
        record2.setId(2L);
        record2.setTitle("Album Two");
    }

    @Test
    void getRecentListens_ShouldReturnList_WhenUserExists() throws Exception {
        ListenEvent event = new ListenEvent();
        event.setId(1L);
        event.setRecord(record1);

        given(analyticsService.getRecentListens(eq("testuser"), any(), any()))
                .willReturn(List.of(event));

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/recent")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].record.title", is("Album One")));
    }

    @Test
    void getTopRecords_ShouldReturnAggregatedCounts() throws Exception {
        TopRecordDto top1 = new TopRecordDto("Album One", "Artist", "url", 2L);
        TopRecordDto top2 = new TopRecordDto("Album Two", "Artist", "url", 1L);

        given(analyticsService.getTopRecords(eq("testuser"), any(), any()))
                .willReturn(List.of(top1, top2));

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/top")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].title", is("Album One")))
                .andExpect(jsonPath("$[0].count", is(2)))
                .andExpect(jsonPath("$[1].title", is("Album Two")));
    }
}
