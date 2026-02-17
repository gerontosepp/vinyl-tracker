package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.service.ScanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ScanController.class)
public class ScanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ScanService scanService;

    @Test
    @WithMockUser
    public void scanBarcode_Success() throws Exception {
        ScanDto.Request request = new ScanDto.Request();
        request.setBarcode("123456");

        ScanDto.Result result = new ScanDto.Result(true, "Found", null);
        when(scanService.processScan("123456", "testuser")).thenReturn(result);

        mockMvc.perform(post("/api/scan")
                .param("username", "testuser")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"barcode\":\"123456\"}")
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser
    public void deleteScan_Success() throws Exception {
        doNothing().when(scanService).deleteScan(1L, "testuser");

        mockMvc.perform(delete("/api/scan/1")
                .param("username", "testuser")
                .with(csrf()))
                .andExpect(status().isNoContent());

        verify(scanService).deleteScan(1L, "testuser");
    }

    @Test
    @WithMockUser
    public void deleteScan_Failure() throws Exception {
        doThrow(new RuntimeException("Error")).when(scanService).deleteScan(1L, "testuser");

        mockMvc.perform(delete("/api/scan/1")
                .param("username", "testuser")
                .with(csrf()))
                .andExpect(status().isBadRequest());
    }
}
