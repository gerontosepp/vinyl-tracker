package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ScanService {

    private final DiscogsApiClient discogsApiClient;
    private final RecordRepository recordRepository;
    private final ListenEventRepository listenEventRepository;
    private final CollectionItemRepository collectionItemRepository;
    private final AppUserRepository userRepository;

    @Transactional
    public ScanDto.Result processScan(String barcode, String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        DiscogsDto.Release discogsRelease = null;
        List<ScanDto.DiscogsMatch> discogsMatches = new java.util.ArrayList<>();

        // 1. Check if Custom Code or Standard Barcode
        String cleanBarcode = barcode.replaceAll("\\s+", "");
        String lower = cleanBarcode.toLowerCase(java.util.Locale.ROOT);
        if (lower.startsWith("discogs-id:") || lower.startsWith("discogsßidö") || lower.startsWith("discogsßidÖ".toLowerCase())) {
            String idStr = cleanBarcode.substring(cleanBarcode.indexOf(':') != -1 ? cleanBarcode.indexOf(':') + 1 : (cleanBarcode.indexOf('Ö') != -1 ? cleanBarcode.indexOf('Ö') + 1 : cleanBarcode.indexOf('ö') + 1));
            try {
                Long releaseId = Long.parseLong(idStr);
                discogsRelease = discogsApiClient.getRelease(releaseId, user);
            } catch (NumberFormatException e) {
                return new ScanDto.Result(false, "Invalid custom barcode format", null, null);
            }
        } else {
            // Standard Barcode -> Search Global DB and filter by Collection Ownership
            DiscogsDto.SearchResponse searchResponse = discogsApiClient.searchDatabaseByBarcode(cleanBarcode, user);
            List<DiscogsDto.SearchResult> results = (searchResponse != null && searchResponse.getResults() != null)
                    ? new java.util.ArrayList<>(searchResponse.getResults())
                    : new java.util.ArrayList<>();

            // Fallback 1: If 12 digits (UPC-A), try 13 digits EAN with leading 0
            if (results.isEmpty() && cleanBarcode.length() == 12) {
                DiscogsDto.SearchResponse fb = discogsApiClient.searchDatabaseByBarcode("0" + cleanBarcode, user);
                if (fb != null && fb.getResults() != null) {
                    results.addAll(fb.getResults());
                }
            }

            // Fallback 2: If 13 digits starting with 0, try 12 digits without leading 0
            if (results.isEmpty() && cleanBarcode.length() == 13 && cleanBarcode.startsWith("0")) {
                DiscogsDto.SearchResponse fb = discogsApiClient.searchDatabaseByBarcode(cleanBarcode.substring(1), user);
                if (fb != null && fb.getResults() != null) {
                    results.addAll(fb.getResults());
                }
            }

            // Fallback 3: Search with general query (q=barcode)
            if (results.isEmpty()) {
                DiscogsDto.SearchResponse fb = discogsApiClient.searchDatabase(cleanBarcode, "release", 1, 10, user);
                if (fb != null && fb.getResults() != null) {
                    results.addAll(fb.getResults());
                }
            }

            for (DiscogsDto.SearchResult result : results) {
                boolean inCollection = collectionItemRepository.findByUserAndRecord_DiscogsId(user, result.getId()).isPresent()
                        || discogsApiClient.isReleaseInCollection(result.getId(), user);
                if (inCollection) {
                    discogsRelease = discogsApiClient.getRelease(result.getId(), user);
                    break;
                }
            }

            if (discogsRelease == null && !results.isEmpty()) {
                for (DiscogsDto.SearchResult r : results) {
                    discogsMatches.add(new ScanDto.DiscogsMatch(
                            r.getId(),
                            r.getTitle(),
                            r.getYear(),
                            r.getThumbUrl(),
                            r.getCoverImage(),
                            r.getFormat(),
                            r.getCountry()
                    ));
                }
            }
        }

        if (discogsRelease == null) {
            if (!discogsMatches.isEmpty()) {
                return new ScanDto.Result(false, "Release not found in collection, but found on Discogs.", null, discogsMatches);
            }
            return new ScanDto.Result(false, "Release not found in collection or invalid barcode.", null, null);
        }

        final DiscogsDto.Release finalRelease = discogsRelease;

        // 2. Persist Record (Cache) if not exists
        Record record = recordRepository.findByDiscogsId(finalRelease.getId())
                .orElseGet(() -> {
                    String artistName = (finalRelease.getArtists() != null && !finalRelease.getArtists().isEmpty())
                            ? finalRelease.getArtists().get(0).getName()
                            : "Unknown";
                    Record newRecord = new Record(
                            finalRelease.getId(),
                            finalRelease.getTitle(),
                            artistName,
                            String.valueOf(finalRelease.getYear()),
                            finalRelease.getThumbUrl());
                    return recordRepository.save(newRecord);
                });

        // 3. Save Listen Event
        ListenEvent event = new ListenEvent(user, record);
        listenEventRepository.save(event);

        ScanDto.TrackedRecord trackedRecord = new ScanDto.TrackedRecord(
                record.getDiscogsId(), record.getTitle(), record.getArtist(), record.getThumbUrl());

        return new ScanDto.Result(true, "Now playing: " + record.getTitle(), trackedRecord);
    }

    @Transactional
    public void deleteScan(Long id, String username) {
        ListenEvent event = listenEventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Scan not found"));

        if (!event.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Unauthorized to delete this scan");
        }

        listenEventRepository.delete(event);
    }

    @Transactional
    public long resetAllListens(String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        long deletedCount = listenEventRepository.deleteAllByUser(user);
        return deletedCount;
    }
}
