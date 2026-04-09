package com.antigravity.vinyltracker.controller;
 
 import com.antigravity.vinyltracker.model.ListenEvent;
 import com.antigravity.vinyltracker.model.dto.TopRecordDto;
 import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
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
 import java.util.Map;
 
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
 
     @BeforeEach
     void setUp() {
         mockMvc = MockMvcBuilders.standaloneSetup(analyticsController).build();
     }
 
     @Test
     void getRecentListens_ShouldReturnList() throws Exception {
         ListenEvent event = new ListenEvent();
         event.setId(1L);
 
         given(analyticsService.getRecentListens(eq("testuser"), any(), any()))
                 .willReturn(List.of(event));
 
         Principal mockPrincipal = () -> "testuser";
 
         mockMvc.perform(get("/api/analytics/recent")
                 .principal(mockPrincipal)
                 .contentType(MediaType.APPLICATION_JSON))
                 .andExpect(status().isOk())
                 .andExpect(jsonPath("$", hasSize(1)));
     }
 
     @Test
     void getTopRecords_ShouldReturnAggregatedCounts() throws Exception {
         TopRecordDto top1 = new TopRecordDto("Album One", "Artist", "url", 2L);
 
         given(analyticsService.getTopRecords(eq("testuser"), any(), any()))
                 .willReturn(List.of(top1));
 
         Principal mockPrincipal = () -> "testuser";
 
         mockMvc.perform(get("/api/analytics/top")
                 .principal(mockPrincipal)
                 .contentType(MediaType.APPLICATION_JSON))
                 .andExpect(status().isOk())
                 .andExpect(jsonPath("$[0].title", is("Album One")))
                 .andExpect(jsonPath("$[0].count", is(2)));
     }
 
     @Test
     void getCollectionValue_ShouldReturnValueResponse() throws Exception {
         DiscogsDto.ValueData median = new DiscogsDto.ValueData("USD", 200.0);
         DiscogsDto.ValueResponse valueResponse = new DiscogsDto.ValueResponse(null, median, null);
 
         given(analyticsService.getCollectionValue("testuser")).willReturn(valueResponse);
 
         Principal mockPrincipal = () -> "testuser";
 
         mockMvc.perform(get("/api/analytics/collection/value")
                 .principal(mockPrincipal)
                 .contentType(MediaType.APPLICATION_JSON))
                 .andExpect(status().isOk())
                 .andExpect(jsonPath("$.median.value", is(200.0)));
     }
 
     @Test
     void getGenreBreakdown_ShouldReturnGenres() throws Exception {
         Map<String, Object> genre = Map.of("name", "Rock", "value", 10);
 
         given(analyticsService.getGenreBreakdown("testuser")).willReturn(List.of(genre));
 
         Principal mockPrincipal = () -> "testuser";
 
         mockMvc.perform(get("/api/analytics/collection/genres")
                 .principal(mockPrincipal)
                 .contentType(MediaType.APPLICATION_JSON))
                 .andExpect(status().isOk())
                 .andExpect(jsonPath("$[0].name", is("Rock")))
                 .andExpect(jsonPath("$[0].value", is(10)));
     }
 }

