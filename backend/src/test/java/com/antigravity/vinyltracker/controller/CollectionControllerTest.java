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
                .andExpect(header().string("Content-Disposition", "attachment; filename=collection_qr_codes.pdf"))
                .andExpect(content().bytes(mockPdf));
    }
}
