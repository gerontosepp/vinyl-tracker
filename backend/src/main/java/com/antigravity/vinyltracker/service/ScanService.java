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

@Service
public class ScanService {

    private final DiscogsService discogsService;
    private final RecordRepository recordRepository;
    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;

    public ScanService(DiscogsService discogsService, RecordRepository recordRepository,
            ListenEventRepository listenEventRepository, AppUserRepository userRepository) {
        this.discogsService = discogsService;
        this.recordRepository = recordRepository;
        this.listenEventRepository = listenEventRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ScanDto.Result processScan(String barcode, String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        DiscogsDto.Release discogsRelease = null;

        // 1. Check if Custom Code or Standard Barcode
        if (barcode.startsWith("discogs-id:")) {
            String idStr = barcode.replace("discogs-id:", "");
            try {
                Long releaseId = Long.parseLong(idStr);
                discogsRelease = discogsService.getRelease(releaseId, user);
            } catch (NumberFormatException e) {
                return new ScanDto.Result(false, "Invalid custom barcode format", null);
            }
        } else {
            // Standard Barcode -> Search Collection
            discogsRelease = discogsService.searchCollectionByBarcode(barcode, user);
        }

        if (discogsRelease == null) {
            return new ScanDto.Result(false, "Release not found in collection or invalid barcode.", null);
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
