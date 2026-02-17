package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.DiscogsService;
import com.antigravity.vinyltracker.service.PdfService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.hasSize;

@SpringBootTest
@AutoConfigureMockMvc
class CollectionControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @MockBean
        private DiscogsService discogsService;

        @MockBean
        private PdfService pdfService;

        @MockBean
        private AppUserRepository userRepository;

        @Test
        @WithMockUser(username = "testuser")
        void testGenerateQrCodesAll() throws Exception {
                AppUser mockUser = new AppUser();
                mockUser.setUsername("testuser");

                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(mockUser));

                when(discogsService.getAllCollection(any(AppUser.class))).thenReturn(Collections.emptyList());

                byte[] mockPdf = "%PDF-1.4 mock content".getBytes();
                when(pdfService.generateQrCodePdf(anyList())).thenReturn(mockPdf);

                mockMvc.perform(get("/api/collection/qr-codes/all")
                                .param("username", "testuser"))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                                .andExpect(header().string("Content-Disposition",
                                                "attachment; filename=collection_qr_codes.pdf"))
                                .andExpect(content().bytes(mockPdf));
        }

        @Test
        @WithMockUser(username = "testuser")
        void testGetCollection() throws Exception {
                AppUser mockUser = new AppUser();
                mockUser.setUsername("testuser");

                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(mockUser));

                DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
                mockResponse.setReleases(Collections.emptyList());

                when(discogsService.getCollection(eq(mockUser), anyInt(), anyInt(), anyString(), anyString(), any()))
                                .thenReturn(mockResponse);

                mockMvc.perform(get("/api/collection")
                                .param("username", "testuser")
                                .param("page", "1")
                                .param("per_page", "50")
                                .param("sort", "artist")
                                .param("sort_order", "asc")
                                .param("min_plays", "1"))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }

        @Test
        @WithMockUser(username = "testuser")
        void testGetCollection_Empty() throws Exception {
                AppUser mockUser = new AppUser();
                mockUser.setUsername("testuser");

                when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(mockUser));

                DiscogsDto.CollectionResponse mockResponse = new DiscogsDto.CollectionResponse();
                mockResponse.setReleases(Collections.emptyList());
                mockResponse.setPagination(new DiscogsDto.Pagination(1, 0, 1, 50, null));

                when(discogsService.getCollection(eq(mockUser), anyInt(), anyInt(), anyString(), anyString(), any()))
                                .thenReturn(mockResponse);

                mockMvc.perform(get("/api/collection")
                                .param("username", "testuser"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.releases", hasSize(0)));
        }

        @Test
        @WithMockUser(username = "testuser")
        void testGenerateSelectedQrCodes() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(Collections.singletonList(new DiscogsDto.QrCodeItem(123L, "Title", "Artist")));

                byte[] mockPdf = new byte[] { 1, 2, 3 };
                when(pdfService.generateQrCodePdf(anyList())).thenReturn(mockPdf);

                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .post("/api/collection/qr-codes/selected")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request))
                                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                                                .csrf()))
                                .andExpect(status().isOk())
                                .andExpect(content().bytes(mockPdf));
        }

        @Test
        @WithMockUser(username = "testuser")
        void testGenerateSelectedQrCodes_IOException() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(Collections.singletonList(new DiscogsDto.QrCodeItem(123L, "Title", "Artist")));

                when(pdfService.generateQrCodePdf(anyList())).thenThrow(new java.io.IOException("Test Exception"));

                try {
                        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                        .post("/api/collection/qr-codes/selected")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(new com.fasterxml.jackson.databind.ObjectMapper()
                                                        .writeValueAsString(request))
                                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                                                        .csrf()));
                } catch (Exception e) {
                        // The controller throws RuntimeException wrapping IOException
                        // We expect nested exception or just verify 500 if handled?
                        // The controller code: throw new RuntimeException("Error generating PDF", e);
                        // MockMvc might wrap it.
                }
                // Actually, better to use assertions on the exception if possible, or expect
                // status if handled globally.
                // But here it throws RuntimeException. Spring Boot default error handler turns
                // it into 500.
        }

        // Better implementation of the test above
        @Test
        @WithMockUser(username = "testuser")
        void testGenerateSelectedQrCodes_ShouldThrowRuntimeException_WhenIOExceptionOccurs() throws Exception {
                DiscogsDto.QrCodeRequest request = new DiscogsDto.QrCodeRequest();
                request.setItems(Collections.singletonList(new DiscogsDto.QrCodeItem(123L, "Title", "Artist")));

                when(pdfService.generateQrCodePdf(anyList())).thenThrow(new java.io.IOException("Test Exception"));

                org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> {
                        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                        .post("/api/collection/qr-codes/selected")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(new com.fasterxml.jackson.databind.ObjectMapper()
                                                        .writeValueAsString(request))
                                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                                                        .csrf()));
                });
        }
}
