package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.SyncResultDto;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import lombok.RequiredArgsConstructor;

@Service
@lombok.extern.slf4j.Slf4j
@RequiredArgsConstructor
public class CollectionSyncService {

    private final DiscogsApiClient discogsApiClient;
    private final RecordRepository recordRepository;
    private final CollectionItemRepository collectionItemRepository;

    @Transactional
    public SyncResultDto syncCollection(AppUser user) {
        log.info("Starting Discogs DB sync for user: {}", user.getUsername());

        int page = 1;
        int perPage = 100;
        int totalPages = 1;

        int addedCount = 0;
        int removedCount = 0;

        Set<Long> remoteInstanceIds = new HashSet<>();

        do {
            DiscogsDto.CollectionResponse response = discogsApiClient.getCollectionReleases(user, page, perPage);

            if (response != null && response.getReleases() != null) {
                for (DiscogsDto.CollectionRelease release : response.getReleases()) {
                    remoteInstanceIds.add(release.getInstanceId());

                    // Check if global Record exists, create if not
                    Long discogsId = release.getId();
                    com.antigravity.vinyltracker.model.Record record = recordRepository.findByDiscogsId(discogsId)
                            .orElseGet(() -> {
                                com.antigravity.vinyltracker.model.Record newRecord = new com.antigravity.vinyltracker.model.Record();
                                newRecord.setDiscogsId(discogsId);
                                newRecord.setTitle(release.getBasicInformation().getTitle());

                                String artist = "";
                                if (release.getBasicInformation().getArtists() != null
                                        && !release.getBasicInformation().getArtists().isEmpty()) {
                                    artist = release.getBasicInformation().getArtists().get(0).getName();
                                }
                                newRecord.setArtist(artist);
                                Integer releaseYear = release.getBasicInformation() != null
                                    ? release.getBasicInformation().getYear()
                                    : null;
                                newRecord.setYear(releaseYear != null ? String.valueOf(releaseYear) : "");
                                newRecord.setThumbUrl(release.getBasicInformation().getThumbUrl());
                                newRecord.setGenres(extractDiscogsTags(release.getBasicInformation()));
                                if (release.getBasicInformation() != null && release.getBasicInformation().getLowestPrice() != null) {
                                    newRecord.setLowestPrice(release.getBasicInformation().getLowestPrice());
                                }

                                return recordRepository.save(newRecord);
                            });

                    List<String> remoteTags = extractDiscogsTags(release.getBasicInformation());
                    if (!remoteTags.isEmpty() && (record.getGenres() == null || record.getGenres().isEmpty())) {
                        record.setGenres(new ArrayList<>(remoteTags));
                        recordRepository.save(record);
                    }

                    // Check if CollectionItem linkage exists for user, create if not
                    java.util.Optional<com.antigravity.vinyltracker.model.CollectionItem> existingItem = collectionItemRepository
                            .findByUserAndInstanceId(user, release.getInstanceId());
                    if (existingItem.isEmpty()) {
                        com.antigravity.vinyltracker.model.CollectionItem item = new com.antigravity.vinyltracker.model.CollectionItem(
                                user, record, release.getInstanceId());
                        collectionItemRepository.save(item);
                        addedCount++;
                    }
                }

                if (response.getPagination() != null) {
                    totalPages = response.getPagination().getPages();
                }
            } else {
                break;
            }
            page++;
        } while (page <= totalPages);

        // Delete any local CollectionItems that are no longer in the remote Discogs collection
        List<com.antigravity.vinyltracker.model.CollectionItem> localItems = collectionItemRepository
                .findAllByUser(user);
        for (com.antigravity.vinyltracker.model.CollectionItem item : localItems) {
            if (!remoteInstanceIds.contains(item.getInstanceId())) {
                log.info("Removing deleted instance {} from local user collection", item.getInstanceId());
                collectionItemRepository.delete(item);
                removedCount++;
            }
        }
        log.info("Sync complete. User {} has {} items in DB. Added: {}, Removed: {}", user.getUsername(),
                remoteInstanceIds.size(), addedCount, removedCount);

        return new SyncResultDto(addedCount, removedCount);
    }

    private List<String> extractDiscogsTags(DiscogsDto.Release release) {
        if (release == null) {
            return List.of();
        }

        Set<String> tags = new LinkedHashSet<>();
        if (release.getGenres() != null) {
            release.getGenres().stream()
                    .filter(tag -> tag != null && !tag.isBlank())
                    .forEach(tags::add);
        }
        if (release.getStyles() != null) {
            release.getStyles().stream()
                    .filter(tag -> tag != null && !tag.isBlank())
                    .forEach(tags::add);
        }

        return new ArrayList<>(tags);
    }
}
