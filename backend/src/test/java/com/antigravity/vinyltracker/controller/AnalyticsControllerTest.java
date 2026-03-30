package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.service.AnalyticsService;
import com.antigravity.vinyltracker.service.DiscogsApiClient;
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
import java.util.Optional;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
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

    @Mock
    private DiscogsApiClient discogsApiClient;

    @Mock
    private CollectionItemRepository collectionItemRepository;

    @Mock
    private AppUserRepository userRepository;

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

    @Test
    void getCollectionValue_ShouldReturnValueResponse() throws Exception {
        AppUser user = new AppUser();
        user.setUsername("testuser");
        user.setDiscogsToken("encrypted");

        DiscogsDto.ValueData min = new DiscogsDto.ValueData("USD", 100.0);
        DiscogsDto.ValueData median = new DiscogsDto.ValueData("USD", 200.0);
        DiscogsDto.ValueData max = new DiscogsDto.ValueData("USD", 500.0);
        DiscogsDto.ValueResponse valueResponse = new DiscogsDto.ValueResponse(min, median, max);

        given(userRepository.findByUsername("testuser")).willReturn(Optional.of(user));
        given(discogsApiClient.getCollectionValue(user)).willReturn(valueResponse);

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/collection/value")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minimum.currency", is("USD")))
                .andExpect(jsonPath("$.median.value", is(200.0)))
                .andExpect(jsonPath("$.maximum.value", is(500.0)));
    }

    @Test
    void getCollectionValue_ShouldReturnBadRequest_WhenDiscogsNotConnected() throws Exception {
        AppUser user = new AppUser();
        user.setUsername("testuser");
        user.setDiscogsToken("");

        given(userRepository.findByUsername("testuser")).willReturn(Optional.of(user));

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/collection/value")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title", is("Discogs not connected")))
                .andExpect(jsonPath("$.detail", notNullValue()))
                .andExpect(jsonPath("$.timestamp", notNullValue()));
    }

    @Test
    void getGenreBreakdown_ShouldReturnTopGenresWithOther() throws Exception {
        AppUser user = new AppUser();
        user.setUsername("testuser");

        Record rock1 = new Record();
        rock1.setGenres(List.of("Rock"));
        Record rock2 = new Record();
        rock2.setGenres(List.of("Rock", "Pop"));
        Record jazz = new Record();
        jazz.setGenres(List.of("Jazz"));
        Record hiphop = new Record();
        hiphop.setGenres(List.of("Hip Hop"));
        Record electronic = new Record();
        electronic.setGenres(List.of("Electronic"));
        Record ambient = new Record();
        ambient.setGenres(List.of("Ambient"));
        Record unknown = new Record();
        unknown.setGenres(List.of());

        CollectionItem item1 = new CollectionItem(user, rock1, 1L);
        CollectionItem item2 = new CollectionItem(user, rock2, 2L);
        CollectionItem item3 = new CollectionItem(user, jazz, 3L);
        CollectionItem item4 = new CollectionItem(user, hiphop, 4L);
        CollectionItem item5 = new CollectionItem(user, electronic, 5L);
        CollectionItem item6 = new CollectionItem(user, ambient, 6L);
        CollectionItem item7 = new CollectionItem(user, unknown, 7L);

        given(userRepository.findByUsername("testuser")).willReturn(Optional.of(user));
        given(collectionItemRepository.findAllByUser(user))
                .willReturn(List.of(item1, item2, item3, item4, item5, item6, item7));

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/collection/genres")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0].name", is("Rock")))
                .andExpect(jsonPath("$[0].value", is(2)))
                .andExpect(jsonPath("$[5].name", is("Other")))
                .andExpect(jsonPath("$[5].value", is(2)));
    }

    @Test
    void getGenreBreakdown_ShouldReturnBadRequest_WhenUserMissing() throws Exception {
        given(userRepository.findByUsername("testuser")).willReturn(Optional.empty());

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(get("/api/analytics/collection/genres")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title", is("User not found")))
                .andExpect(jsonPath("$.detail", notNullValue()))
                .andExpect(jsonPath("$.timestamp", notNullValue()));
    }
}
