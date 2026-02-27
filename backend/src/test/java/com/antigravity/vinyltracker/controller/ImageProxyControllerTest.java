package com.antigravity.vinyltracker.controller;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.ResponseEntity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

@WebMvcTest(ImageProxyController.class)
@AutoConfigureMockMvc(addFilters = false)
class ImageProxyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private com.antigravity.vinyltracker.security.JwtService jwtService;

    @Test
    void proxyImage_ShouldReturnBadRequest_WhenUrlIsMissing() throws Exception {
        mockMvc.perform(get("/api/proxy/image"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void proxyImage_ShouldReturnBadRequest_WhenUrlIsInvalid() throws Exception {
        mockMvc.perform(get("/api/proxy/image").param("url", "not-a-url"))
                .andExpect(status().isBadRequest());
    }
}
