package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.service.ImageProxyService;
import com.antigravity.vinyltracker.service.ImageProxyUrlValidator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@WebMvcTest(ImageProxyController.class)
@AutoConfigureMockMvc(addFilters = false)
class ImageProxyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ImageProxyService imageProxyService;

    @MockitoBean
    private ImageProxyUrlValidator imageProxyUrlValidator;

    @MockitoBean
    private com.antigravity.vinyltracker.security.JwtService jwtService;

    @MockitoBean
    private com.antigravity.vinyltracker.security.AuthCookieService authCookieService;

    @Test
    void proxyImage_ShouldReturnBadRequest_WhenUrlIsMissing() throws Exception {
        when(imageProxyUrlValidator.isAllowed(anyString())).thenReturn(false);

        mockMvc.perform(get("/api/proxy/image"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void proxyImage_ShouldReturnBadRequest_WhenUrlIsInvalid() throws Exception {
        when(imageProxyUrlValidator.isAllowed("not-a-url")).thenReturn(false);

        mockMvc.perform(get("/api/proxy/image").param("url", "not-a-url"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(imageProxyService);
    }

    @Test
    void proxyImage_ShouldReturnBadRequest_WhenUrlIsBlockedByValidator() throws Exception {
        String blockedUrl = "http://localhost:8080/admin";
        when(imageProxyUrlValidator.isAllowed(blockedUrl)).thenReturn(false);

        mockMvc.perform(get("/api/proxy/image").param("url", blockedUrl))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(imageProxyService);
    }

    @Test
    void proxyImage_ShouldReturnProxiedImage_WhenUrlIsAllowed() throws Exception {
        String allowedUrl = "https://i.discogs.com/image.jpg";
        when(imageProxyUrlValidator.isAllowed(allowedUrl)).thenReturn(true);
        when(imageProxyService.proxyImage(allowedUrl))
                .thenReturn(java.util.Optional.of(ResponseEntity.status(HttpStatus.OK).body(new byte[]{1, 2, 3})));

        mockMvc.perform(get("/api/proxy/image").param("url", allowedUrl))
                .andExpect(status().isOk());
    }

    @Test
    void proxyImage_ShouldReturnBadGateway_WhenProxyFetchFails() throws Exception {
        String allowedUrl = "https://i.discogs.com/missing.jpg";
        when(imageProxyUrlValidator.isAllowed(allowedUrl)).thenReturn(true);
        when(imageProxyService.proxyImage(allowedUrl)).thenReturn(java.util.Optional.empty());

        mockMvc.perform(get("/api/proxy/image").param("url", allowedUrl))
                .andExpect(status().isBadGateway());
    }
}
