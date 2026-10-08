package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.exception.RoonApiException;
import com.antigravity.vinyltracker.model.dto.RoonPlayRequestDto;
import com.antigravity.vinyltracker.model.dto.RoonSettingsDto;
import com.antigravity.vinyltracker.model.dto.RoonStatusDto;
import com.antigravity.vinyltracker.model.dto.RoonZoneDto;
import com.antigravity.vinyltracker.security.AuthCookieService;
import com.antigravity.vinyltracker.security.JwtService;
import com.antigravity.vinyltracker.service.RoonApiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RoonController.class)
@SuppressWarnings("null")
public class RoonControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RoonApiService roonApiService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AuthCookieService authCookieService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @WithMockUser(username = "testuser")
    public void getStatus_Success() throws Exception {
        RoonStatusDto statusDto = RoonStatusDto.builder()
                .connected(true)
                .paired(true)
                .coreId("core-123")
                .coreName("My Roon Core")
                .zones(List.of(new RoonZoneDto("zone-1", "Living Room", "playing")))
                .build();

        when(roonApiService.getStatus("testuser")).thenReturn(statusDto);

        Principal principal = () -> "testuser";

        mockMvc.perform(get("/api/roon/status")
                .principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.paired").value(true))
                .andExpect(jsonPath("$.coreName").value("My Roon Core"))
                .andExpect(jsonPath("$.zones[0].zoneId").value("zone-1"));
    }

    @Test
    @WithMockUser(username = "testuser")
    public void getZones_Success() throws Exception {
        List<RoonZoneDto> zones = List.of(
                new RoonZoneDto("z1", "Kitchen", "stopped"),
                new RoonZoneDto("z2", "Office", "playing")
        );

        when(roonApiService.getZones("testuser")).thenReturn(zones);

        Principal principal = () -> "testuser";

        mockMvc.perform(get("/api/roon/zones")
                .principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Kitchen"));
    }

    @Test
    @WithMockUser(username = "testuser")
    public void updateSettings_Success() throws Exception {
        RoonSettingsDto req = RoonSettingsDto.builder()
                .roonHost("192.168.1.100")
                .roonPort(9100)
                .roonZoneId("z1")
                .roonZoneName("Living Room")
                .build();

        RoonStatusDto res = RoonStatusDto.builder()
                .connected(true)
                .paired(true)
                .build();

        when(roonApiService.updateSettings(eq("testuser"), any(RoonSettingsDto.class))).thenReturn(res);

        Principal principal = () -> "testuser";

        mockMvc.perform(post("/api/roon/settings")
                .principal(principal)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req))
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true));
    }

    @Test
    @WithMockUser(username = "testuser")
    public void updateSettings_InvalidPort_ShouldReturnBadRequest() throws Exception {
        RoonSettingsDto req = RoonSettingsDto.builder()
                .roonHost("192.168.1.100")
                .roonPort(99999) // Invalid port > 65535
                .build();

        Principal principal = () -> "testuser";

        mockMvc.perform(post("/api/roon/settings")
                .principal(principal)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req))
                .with(csrf()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "testuser")
    public void play_Success() throws Exception {
        RoonPlayRequestDto req = RoonPlayRequestDto.builder()
                .artist("Pink Floyd")
                .title("The Dark Side of the Moon")
                .zoneId("z1")
                .build();

        when(roonApiService.playAlbum(eq("testuser"), any(RoonPlayRequestDto.class))).thenReturn(true);

        Principal principal = () -> "testuser";

        mockMvc.perform(post("/api/roon/play")
                .principal(principal)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req))
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Playback command sent to Roon Core"));
    }

    @Test
    @WithMockUser(username = "testuser")
    public void play_BlankArtist_ShouldReturnBadRequest() throws Exception {
        RoonPlayRequestDto req = RoonPlayRequestDto.builder()
                .artist("")
                .title("The Dark Side of the Moon")
                .build();

        Principal principal = () -> "testuser";

        mockMvc.perform(post("/api/roon/play")
                .principal(principal)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req))
                .with(csrf()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "testuser")
    public void play_RoonApiError_ShouldReturnBadGateway() throws Exception {
        RoonPlayRequestDto req = RoonPlayRequestDto.builder()
                .artist("Pink Floyd")
                .title("The Dark Side of the Moon")
                .build();

        when(roonApiService.playAlbum(eq("testuser"), any(RoonPlayRequestDto.class)))
                .thenThrow(new RoonApiException("Album not found in Roon library"));

        Principal principal = () -> "testuser";

        mockMvc.perform(post("/api/roon/play")
                .principal(principal)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req))
                .with(csrf()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.title").value("Roon API error"))
                .andExpect(jsonPath("$.detail").value("Album not found in Roon library"));
    }
}
