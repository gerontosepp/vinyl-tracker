package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.ScanDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ScanService {

    private final DiscogsApiClient discogsApiClient;
    private final RecordRepository recordRepository;
    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;

    @Transactional
    public ScanDto.Result processScan(String barcode, String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        DiscogsDto.Release discogsRelease = null;
        List<ScanDto.DiscogsMatch> discogsMatches = new java.util.ArrayList<>();

        // 1. Check if Custom Code or Standard Barcode
        if (barcode.startsWith("discogs-id:")) {
            String idStr = barcode.replace("discogs-id:", "");
            try {
                Long releaseId = Long.parseLong(idStr);
                if (discogsApiClient.isReleaseInCollection(releaseId, user)) {
                    discogsRelease = discogsApiClient.getRelease(releaseId, user);
                } else {
                    DiscogsDto.Release fetched = discogsApiClient.getRelease(releaseId, user);
                    if (fetched != null) {
                        String artist = (fetched.getArtists() != null && !fetched.getArtists().isEmpty())
                                ? fetched.getArtists().get(0).getName()
                                : "Unknown";
                        discogsMatches.add(new ScanDto.DiscogsMatch(
                                fetched.getId(),
                                artist + " - " + fetched.getTitle(),
                                String.valueOf(fetched.getYear()),
                                fetched.getThumbUrl(),
                                fetched.getThumbUrl(),
                                java.util.Collections.emptyList(),
                                null
                        ));
                    }
                }
            } catch (NumberFormatException e) {
                return new ScanDto.Result(false, "Invalid custom barcode format", null, null);
            }
        } else {
            // Standard Barcode -> Search Global DB and filter by Collection Ownership
            DiscogsDto.SearchResponse searchResponse = discogsApiClient.searchDatabaseByBarcode(barcode, user);
            List<DiscogsDto.SearchResult> results = (searchResponse != null && searchResponse.getResults() != null)
                    ? searchResponse.getResults()
                    : java.util.Collections.emptyList();

            for (DiscogsDto.SearchResult result : results) {
                if (discogsApiClient.isReleaseInCollection(result.getId(), user)) {
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
            return new ScanDto.Result(false, "Release not found in collection or on Discogs.", null, null);
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
