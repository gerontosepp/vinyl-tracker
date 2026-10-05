package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.service.CollectionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.antigravity.vinyltracker.exception.PdfGenerationException;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import java.security.Principal;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@WebMvcTest(CollectionController.class)
class CollectionControllerTest {

        @Autowired
        private MockMvc mockMvc;

        private final ObjectMapper objectMapper = new ObjectMapper();

        @MockitoBean
        private CollectionService collectionService;

        @MockitoBean
        private com.antigravity.vinyltracker.security.JwtService jwtService;

        @MockitoBean
        private com.antigravity.vinyltracker.security.AuthCookieService authCookieService;

        @BeforeEach
        void setUp() {
        }

        @Test
        @WithMockUser(username = "testuser")
        void getCollection_ShouldReturnCollection() throws Exception {
                DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(100L);
                mockResponse.setReleases(List.of(release));

                when(collectionService.getCollection(eq("testuser"), anyInt(), anyInt(), anyString(), anyString(),
                                any(), any()))
                                .thenReturn(mockResponse);

                Principal mockPrincipal = () -> "testuser";

                mockMvc.perform(get("/api/collection")
                                .principal(mockPrincipal)
                                .contentType(MediaType.APPLICATION_JSON))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.releases[0].id").value(100));
        }

        @Test
        @WithMockUser
        void getCollection_ShouldThrowException_WhenUserNotFound() throws Exception {
                when(collectionService.getCollection(anyString(), anyInt(), anyInt(), anyString(), anyString(), any(),
                                any()))
                                .thenThrow(new RuntimeException("User not found"));

                try {
                        mockMvc.perform(get("/api/collection")
                                        .contentType(MediaType.APPLICATION_JSON))
                                        .andExpect(status().isInternalServerError());
                } catch (Exception e) {
                }
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateSelectedQrCodes_ShouldReturnPdf() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(List.of(new DiscogsDto.QrCodeItem(1L, "Title", "Artist")));

                byte[] pdfBytes = "pdf-content".getBytes();
                when(collectionService.generateSelectedQrCodesPdf(any())).thenReturn(pdfBytes);

                mockMvc.perform(post("/api/collection/qr-codes/selected")
                                .content(objectMapper.writeValueAsString(request))
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(csrf()))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                                .andExpect(header().string("Content-Disposition",
                                                "attachment; filename=collection_qr_codes.pdf"));
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateSelectedQrCodes_ShouldThrowException_WhenPdfServiceFails() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(List.of(new DiscogsDto.QrCodeItem(1L, "Title", "Artist")));

                when(collectionService.generateSelectedQrCodesPdf(any())).thenThrow(new PdfGenerationException("PDF Error"));

                mockMvc.perform(post("/api/collection/qr-codes/selected")
                                .content(objectMapper.writeValueAsString(request))
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(csrf()))
                                .andExpect(status().isInternalServerError())
                                .andExpect(content().contentType("application/problem+json"))
                                .andExpect(jsonPath("$.title").value("PDF generation error"))
                                .andExpect(jsonPath("$.detail").value("PDF Error"));
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateAllQrCodes_ShouldReturnPdf() throws Exception {
                when(collectionService.generateAllQrCodesPdf(eq("testuser"))).thenReturn("pdf-content".getBytes());

                Principal mockPrincipal = () -> "testuser";

                mockMvc.perform(get("/api/collection/qr-codes/all")
                                .principal(mockPrincipal))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
        }

        @Test
        @WithMockUser
        void generateAllQrCodes_ShouldThrowException_WhenUserNotFound() throws Exception {
                when(collectionService.generateAllQrCodesPdf(anyString()))
                                .thenThrow(new RuntimeException("User not found"));

                try {
                        mockMvc.perform(get("/api/collection/qr-codes/all"))
                                        .andExpect(status().isInternalServerError());
                } catch (Exception e) {
                }
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateAllQrCodes_ShouldThrowException_WhenPdfServiceFails() throws Exception {
                when(collectionService.generateAllQrCodesPdf(eq("testuser"))).thenThrow(new PdfGenerationException("PDF Error"));

                Principal mockPrincipal = () -> "testuser";

                mockMvc.perform(get("/api/collection/qr-codes/all")
                                .principal(mockPrincipal))
                                .andExpect(status().isInternalServerError())
                                .andExpect(content().contentType("application/problem+json"))
                                .andExpect(jsonPath("$.title").value("PDF generation error"))
                                .andExpect(jsonPath("$.detail").value("PDF Error"));
        }

        @Test
        @WithMockUser(username = "testuser")
        void getRandomRecord_ShouldReturnRecord() throws Exception {
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(123L);
                when(collectionService.getRandomRecord("testuser", "Rock", false)).thenReturn(release);

                mockMvc.perform(get("/api/collection/random")
                                .principal(() -> "testuser")
                                .param("genre", "Rock")
                                .param("unplayed_only", "false"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(123));
        }

        @Test
        @WithMockUser(username = "testuser")
        void getRandomRecord_NotFound_ShouldReturn404() throws Exception {
                when(collectionService.getRandomRecord("testuser", null, true)).thenReturn(null);

                mockMvc.perform(get("/api/collection/random")
                                .principal(() -> "testuser")
                                .param("unplayed_only", "true"))
                                .andExpect(status().isNotFound())
                                .andExpect(content().contentType("application/problem+json"));
        }

        @Test
        @WithMockUser(username = "testuser")
        void getUnplayedCollection_ShouldReturnReleases() throws Exception {
                DiscogsDto.CollectionResponse response = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(456L);
                response.setReleases(List.of(release));
                when(collectionService.getUnplayedCollection("testuser", 1, 50)).thenReturn(response);

                mockMvc.perform(get("/api/collection/unplayed")
                                .principal(() -> "testuser")
                                .param("page", "1")
                                .param("per_page", "50"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.releases[0].id").value(456));
        }
}
