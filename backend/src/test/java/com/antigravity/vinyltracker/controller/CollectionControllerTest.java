package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.DiscogsService;
import com.antigravity.vinyltracker.service.PdfService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

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

        @Autowired
        private ObjectMapper objectMapper;

        @MockitoBean
        private DiscogsService discogsService;

        @MockitoBean
        private PdfService pdfService;

        @MockitoBean
        private com.antigravity.vinyltracker.security.JwtService jwtService;

        @MockitoBean
        private AppUserRepository userRepository;

        private AppUser user;

        @BeforeEach
        void setUp() {
                user = new AppUser();
                user.setUsername("testuser");
                user.setId(1L);
        }

        @Test
        @WithMockUser(username = "testuser")
        void getCollection_ShouldReturnCollection() throws Exception {
                DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(100L);
                mockResponse.setReleases(List.of(release));

                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
                when(discogsService.getCollection(eq(user), anyInt(), anyInt(), anyString(), anyString(), any()))
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
                when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

                Principal mockPrincipal = () -> "unknown";

                // Expect 500 or 404 depending on error handling. Default is 500 for
                // RuntimeException.
                try {
                        mockMvc.perform(get("/api/collection")
                                        .principal(mockPrincipal)
                                        .contentType(MediaType.APPLICATION_JSON))
                                        .andExpect(status().isInternalServerError());
                } catch (Exception e) {
                        // MockMvc might throw check
                }
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateSelectedQrCodes_ShouldReturnPdf() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(List.of(new DiscogsDto.QrCodeItem(1L, "Title", "Artist")));

                byte[] pdfBytes = "pdf-content".getBytes();
                when(pdfService.generateQrCodePdf(any())).thenReturn(pdfBytes);

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

                when(pdfService.generateQrCodePdf(any())).thenThrow(new IOException("PDF Error"));

                // Expect RuntimeException wrapped
                org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> {
                        mockMvc.perform(post("/api/collection/qr-codes/selected")
                                        .content(objectMapper.writeValueAsString(request))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .with(csrf()));
                });
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateAllQrCodes_ShouldReturnPdf() throws Exception {
                DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
                release.setId(1L);
                DiscogsDto.BasicInformation info = new DiscogsDto.BasicInformation();
                info.setTitle("Title");
                DiscogsDto.Artist artist = new DiscogsDto.Artist();
                artist.setName("Artist");
                info.setArtists(List.of(artist));
                release.setBasicInformation(info);

                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
                when(discogsService.getAllCollection(user)).thenReturn(List.of(release));
                when(pdfService.generateQrCodePdf(any())).thenReturn("pdf-content".getBytes());

                Principal mockPrincipal = () -> "testuser";

                mockMvc.perform(get("/api/collection/qr-codes/all")
                                .principal(mockPrincipal))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
        }

        @Test
        @WithMockUser
        void generateAllQrCodes_ShouldThrowException_WhenUserNotFound() throws Exception {
                when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

                Principal mockPrincipal = () -> "unknown";

                try {
                        mockMvc.perform(get("/api/collection/qr-codes/all")
                                        .principal(mockPrincipal))
                                        .andExpect(status().isInternalServerError());
                } catch (Exception e) {
                        // check
                }
        }

        @Test
        @WithMockUser(username = "testuser")
        void generateAllQrCodes_ShouldThrowException_WhenPdfServiceFails() throws Exception {
                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
                when(discogsService.getAllCollection(user)).thenReturn(Collections.emptyList());
                when(pdfService.generateQrCodePdf(any())).thenThrow(new IOException("PDF Error"));

                Principal mockPrincipal = () -> "testuser";

                org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> {
                        mockMvc.perform(get("/api/collection/qr-codes/all")
                                        .principal(mockPrincipal));
                });
        }
}
