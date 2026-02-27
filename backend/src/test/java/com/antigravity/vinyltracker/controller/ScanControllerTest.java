package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.service.ScanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.security.Principal;
import com.antigravity.vinyltracker.security.JwtService;

@WebMvcTest(ScanController.class)
public class ScanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ScanService scanService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @WithMockUser(username = "testuser")
    public void scanBarcode_Success() throws Exception {
        ScanDto.Request request = new ScanDto.Request();
        request.setBarcode("123456");

        ScanDto.Result result = new ScanDto.Result(true, "Found", null);
        when(scanService.processScan("123456", "testuser")).thenReturn(result);

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(post("/api/scan")
                .principal(mockPrincipal)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"barcode\":\"123456\"}")
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser(username = "testuser")
    public void deleteScan_Success() throws Exception {
        doNothing().when(scanService).deleteScan(1L, "testuser");

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(delete("/api/scan/1")
                .principal(mockPrincipal)
                .with(csrf()))
                .andExpect(status().isNoContent());

        verify(scanService).deleteScan(1L, "testuser");
    }

    @Test
    @WithMockUser(username = "testuser")
    public void deleteScan_Failure() throws Exception {
        doThrow(new RuntimeException("Error")).when(scanService).deleteScan(1L, "testuser");

        Principal mockPrincipal = () -> "testuser";

        mockMvc.perform(delete("/api/scan/1")
                .principal(mockPrincipal)
                .with(csrf()))
                .andExpect(status().isBadRequest());
    }
}
