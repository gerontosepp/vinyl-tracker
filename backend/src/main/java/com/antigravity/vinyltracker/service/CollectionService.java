package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;

@Service
public class CollectionService {
    private final CollectionQueryService collectionQueryService;
    private final CollectionSyncService collectionSyncService;
    private final PdfService pdfService;
    private final AppUserRepository userRepository;

    public CollectionService(CollectionQueryService collectionQueryService,
                             CollectionSyncService collectionSyncService,
                             PdfService pdfService,
                             AppUserRepository userRepository) {
        this.collectionQueryService = collectionQueryService;
        this.collectionSyncService = collectionSyncService;
        this.pdfService = pdfService;
        this.userRepository = userRepository;
    }

    public DiscogsDto.CollectionResponse getCollection(String username, int page, int per_page, String sort,
            String sort_order, Integer min_plays, String search) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
        return collectionQueryService.getCollection(user, page, per_page, sort, sort_order, min_plays, search);
    }

    public com.antigravity.vinyltracker.model.dto.SyncResultDto forceSync(String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
        return collectionSyncService.syncCollection(user);
    }

    public byte[] generateSelectedQrCodesPdf(DiscogsDto.QrCodeRequest request) throws IOException {
        return pdfService.generateQrCodePdf(request.getItems());
    }

    public byte[] generateAllQrCodesPdf(String username) throws IOException {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        List<DiscogsDto.CollectionRelease> releases = collectionQueryService.getAllCollection(user);
        List<DiscogsDto.QrCodeItem> items = releases.stream().map(this::mapToQrItem).sorted((a, b) -> {
            String artist1 = a.getArtist() != null ? a.getArtist() : "";
            String artist2 = b.getArtist() != null ? b.getArtist() : "";
            return artist1.compareToIgnoreCase(artist2);
        }).toList();

        return pdfService.generateQrCodePdf(items);
    }

    private DiscogsDto.QrCodeItem mapToQrItem(DiscogsDto.CollectionRelease release) {
        String artist = "Unknown";
        if (release.getBasicInformation().getArtists() != null
                && !release.getBasicInformation().getArtists().isEmpty()) {
            artist = release.getBasicInformation().getArtists().get(0).getName();
        }
        return new DiscogsDto.QrCodeItem(release.getId(), release.getBasicInformation().getTitle(), artist);
    }
}
