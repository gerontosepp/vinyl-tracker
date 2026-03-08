package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpHeaders;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import org.springframework.transaction.annotation.Transactional;

@Service
@lombok.extern.slf4j.Slf4j
public class DiscogsService {

    private final RestClient restClient;
    private final TokenEncryptionService tokenService;
    private final com.antigravity.vinyltracker.repository.ListenEventRepository listenEventRepository;
    private final com.antigravity.vinyltracker.repository.RecordRepository recordRepository;
    private final com.antigravity.vinyltracker.repository.CollectionItemRepository collectionItemRepository;
    private static final String BASE_URL = "https://api.discogs.com";

    public DiscogsService(RestClient.Builder restClientBuilder, TokenEncryptionService tokenService,
            com.antigravity.vinyltracker.repository.ListenEventRepository listenEventRepository,
            com.antigravity.vinyltracker.repository.RecordRepository recordRepository,
            com.antigravity.vinyltracker.repository.CollectionItemRepository collectionItemRepository) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
        this.tokenService = tokenService;
        this.listenEventRepository = listenEventRepository;
        this.recordRepository = recordRepository;
        this.collectionItemRepository = collectionItemRepository;
    }

    public DiscogsDto.Release getRelease(Long releaseId, AppUser user) {
        log.info("Fetching release details for ID: {}", releaseId);
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        return restClient.get()
                .uri("/releases/{id}", releaseId)
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.Release.class);
    }

    public DiscogsDto.Release searchCollectionByBarcode(String barcode, AppUser user) {
        log.info("Searching Discogs for barcode: {}", barcode);
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        // 1. Search Global DB
        DiscogsDto.SearchResponse searchResponse = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/database/search")
                        .queryParam("barcode", barcode)
                        .queryParam("type", "release")
                        .build())
                .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                .retrieve()
                .body(DiscogsDto.SearchResponse.class);

        if (searchResponse == null || searchResponse.getResults() == null) {
            log.warn("No results found on Discogs for barcode: {}", barcode);
            return null;
        }

        log.info("Found {} results for barcode {}", searchResponse.getResults().size(), barcode);

        // 2. Filter by Collection Ownership
        for (DiscogsDto.SearchResult result : searchResponse.getResults()) {
            log.info("Checking if release {} ({}) is in collection...", result.getId(), result.getTitle());
            if (isReleaseInCollection(result.getId(), user)) { // This calls another method using user, but we should
                                                               // pass decrypted token or decrypt inside
                log.info("Release matches and is in collection!");
                return getRelease(result.getId(), user);
            }
        }
        log.warn("Barcode found in Discogs, but no matching release in user's collection.");
        return null;
    }

    public boolean isReleaseInCollection(Long releaseId, AppUser user) {
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null)
            return false;

        try {
            restClient.get()
                    .uri("/users/{username}/collection/releases/{releaseId}", user.getDiscogsUsername(), releaseId)
                    .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                    .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            // log.debug("Release {} not in collection: {}", releaseId, e.getMessage());
            return false;
        }
    }

    public DiscogsDto.CollectionResponse getCollection(AppUser user, int page, int perPage, String sort,
            String sortOrder, Integer minPlays, String search) {

        log.info("Fetching collection from local DB for user: {}", user.getUsername());

        // Setup pagination
        org.springframework.data.domain.Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder)
                ? org.springframework.data.domain.Sort.Direction.DESC
                : org.springframework.data.domain.Sort.Direction.ASC;

        org.springframework.data.domain.Pageable pageable;
        if ("listens".equalsIgnoreCase(sort)) {
            pageable = org.springframework.data.domain.PageRequest.of(page - 1, perPage);
        } else if ("artist".equalsIgnoreCase(sort)) {
            pageable = org.springframework.data.domain.PageRequest.of(page - 1, perPage,
                    org.springframework.data.domain.Sort.by(direction, "record.artist"));
        } else {
            pageable = org.springframework.data.domain.PageRequest.of(page - 1, perPage,
                    org.springframework.data.domain.Sort.by(direction, "addedAt"));
        }

        org.springframework.data.domain.Page<?> pagedResult;
        boolean hasSearch = search != null && !search.trim().isEmpty();
        String searchLower = hasSearch ? search.trim().toLowerCase() : "";

        if ("listens".equalsIgnoreCase(sort)) {
            if ("desc".equalsIgnoreCase(sortOrder)) {
                if (hasSearch) {
                    pagedResult = collectionItemRepository.searchByUserAndKeywordOrderByPlayCountDesc(user, searchLower,
                            pageable);
                } else {
                    pagedResult = collectionItemRepository.findAllByUserOrderByPlayCountDesc(user, pageable);
                }
            } else {
                if (hasSearch) {
                    pagedResult = collectionItemRepository.searchByUserAndKeywordOrderByPlayCountAsc(user, searchLower,
                            pageable);
                } else {
                    pagedResult = collectionItemRepository.findAllByUserOrderByPlayCountAsc(user, pageable);
                }
            }
        } else {
            // Default query with optional sorting
            if (hasSearch) {
                pagedResult = collectionItemRepository.searchByUserAndKeyword(user, searchLower, pageable);
            } else {
                pagedResult = collectionItemRepository.findAllByUser(user, pageable);
            }
        }

        List<DiscogsDto.CollectionRelease> releases = pagedResult.getContent().stream()
                .map(item -> {
                    com.antigravity.vinyltracker.model.CollectionItem ci;
                    Long playCount = 0L;
                    if (item instanceof Object[]) {
                        Object[] row = (Object[]) item;
                        ci = (com.antigravity.vinyltracker.model.CollectionItem) row[0];
                        if (row.length > 1 && row[1] instanceof Long) {
                            playCount = (Long) row[1];
                        }
                    } else {
                        ci = (com.antigravity.vinyltracker.model.CollectionItem) item;
                        playCount = listenEventRepository.countByRecordAndUser(ci.getRecord(), user);
                    }

                    if (minPlays != null && minPlays > 0 && playCount < minPlays) {
                        return null; // Will filter out later
                    }

                    return mapToCollectionRelease(ci, playCount);
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        // If minPlays filtering altered the real count, pagination metadata might be
        // slightly off
        // But since minPlays is mostly used for analytics/profiles, this is acceptable
        // for now.

        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setItems((int) pagedResult.getTotalElements());
        pagination.setPage(page);
        pagination.setPerPage(perPage);
        pagination.setPages(pagedResult.getTotalPages());

        return new DiscogsDto.CollectionResponse(releases, pagination);
    }

    private DiscogsDto.CollectionRelease mapToCollectionRelease(com.antigravity.vinyltracker.model.CollectionItem item,
            Long listenCount) {
        DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
        release.setId(item.getRecord().getDiscogsId());
        release.setInstanceId(item.getInstanceId());
        release.setListenCount(listenCount);

        DiscogsDto.BasicInformation basicInfo = new DiscogsDto.BasicInformation();
        basicInfo.setId(item.getRecord().getDiscogsId());
        basicInfo.setTitle(item.getRecord().getTitle());
        basicInfo.setThumbUrl(item.getRecord().getThumbUrl());
        basicInfo.setCoverImage(item.getRecord().getThumbUrl());

        DiscogsDto.Artist artist = new DiscogsDto.Artist();
        artist.setName(item.getRecord().getArtist());
        basicInfo.setArtists(List.of(artist));

        try {
            basicInfo.setYear(Integer.parseInt(item.getRecord().getYear()));
        } catch (NumberFormatException e) {
            basicInfo.setYear(0);
        }

        release.setBasicInformation(basicInfo);
        return release;
    }

    public List<DiscogsDto.CollectionRelease> getAllCollection(AppUser user) {
        List<com.antigravity.vinyltracker.model.CollectionItem> items = collectionItemRepository.findAllByUser(user);
        return items.stream().map(item -> {
            Long playCount = listenEventRepository.countByRecordAndUser(item.getRecord(), user);
            return mapToCollectionRelease(item, playCount);
        }).toList();
    }

    @Transactional
    public com.antigravity.vinyltracker.model.dto.SyncResultDto syncCollection(AppUser user) {
        log.info("Starting Discogs DB sync for user: {}", user.getUsername());
        String decryptedToken = tokenService.decrypt(user.getDiscogsToken());
        if (decryptedToken == null) {
            throw new RuntimeException("Could not decrypt Discogs token for user " + user.getUsername());
        }

        int page = 1;
        int perPage = 100;
        int totalPages = 1;

        int addedCount = 0;
        int removedCount = 0;

        Set<Long> remoteInstanceIds = new HashSet<>();

        do {
            log.info("Fetching Discogs page {} for user {}", page, user.getUsername());
            DiscogsDto.CollectionResponse response = restClient.get()
                    .uri("/users/{username}/collection/folders/0/releases?page={page}&per_page={perPage}&sort={sort}&sort_order={sortOrder}",
                            user.getDiscogsUsername(), page, perPage, "artist", "asc")
                    .header(HttpHeaders.USER_AGENT, "VinylTrackerApp/1.0")
                    .header(HttpHeaders.AUTHORIZATION, "Discogs token=" + decryptedToken)
                    .retrieve()
                    .body(DiscogsDto.CollectionResponse.class);

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
                                newRecord.setYear(String.valueOf(release.getBasicInformation().getYear()));
                                newRecord.setThumbUrl(release.getBasicInformation().getThumbUrl());

                                return recordRepository.save(newRecord);
                            });

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

        // Delete any local CollectionItems that are no longer in the remote Discogs
        // collection
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

        return new com.antigravity.vinyltracker.model.dto.SyncResultDto(addedCount, removedCount);
    }
}
