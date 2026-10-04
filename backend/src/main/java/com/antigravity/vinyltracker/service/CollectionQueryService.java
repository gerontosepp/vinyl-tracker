package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import lombok.RequiredArgsConstructor;

@Service
@lombok.extern.slf4j.Slf4j
@RequiredArgsConstructor
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public class CollectionQueryService {

    private final ListenEventRepository listenEventRepository;
    private final CollectionItemRepository collectionItemRepository;

    public DiscogsDto.CollectionResponse getCollection(AppUser user, int page, int perPage, String sort,
                                                       String sortOrder, Integer minPlays, String search) {

        log.info("Fetching collection from local DB for user: {}", user.getUsername());

        // Setup pagination
        Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder)
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        Pageable pageable;
        if ("listens".equalsIgnoreCase(sort)) {
            pageable = PageRequest.of(page - 1, perPage);
        } else if ("year".equalsIgnoreCase(sort)) {
            pageable = PageRequest.of(page - 1, perPage,
                    Sort.by(
                            new Sort.Order(direction, "record.year").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.artist").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.title").nullsLast()
                    ));
        } else if ("format".equalsIgnoreCase(sort)) {
            pageable = PageRequest.of(page - 1, perPage,
                    Sort.by(
                            new Sort.Order(direction, "record.format").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.artist").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.year").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.title").nullsLast()
                    ));
        } else if ("artist".equalsIgnoreCase(sort)) {
            pageable = PageRequest.of(page - 1, perPage,
                    Sort.by(
                            new Sort.Order(direction, "record.artist").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.year").nullsLast(),
                            new Sort.Order(Sort.Direction.ASC, "record.title").nullsLast()
                    ));
        } else {
            pageable = PageRequest.of(page - 1, perPage, Sort.by(direction, "addedAt"));
        }

        Page<?> pagedResult;
        boolean hasSearch = search != null && !search.trim().isEmpty();
        String searchLower = (search != null && search.trim().length() > 0) ? search.trim().toLowerCase() : "";

        if ("listens".equalsIgnoreCase(sort)) {
            if ("desc".equalsIgnoreCase(sortOrder)) {
                if (hasSearch) {
                    pagedResult = collectionItemRepository.searchByUserAndKeywordOrderByPlayCountDesc(user, searchLower, pageable);
                } else {
                    pagedResult = collectionItemRepository.findAllByUserOrderByPlayCountDesc(user, pageable);
                }
            } else {
                if (hasSearch) {
                    pagedResult = collectionItemRepository.searchByUserAndKeywordOrderByPlayCountAsc(user, searchLower, pageable);
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

        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setItems((int) pagedResult.getTotalElements());
        pagination.setPage(page);
        pagination.setPerPage(perPage);
        pagination.setPages(pagedResult.getTotalPages());

        return new DiscogsDto.CollectionResponse(releases, pagination);
    }

    public DiscogsDto.CollectionRelease getRandomRecord(AppUser user, String genre, boolean unplayedOnly) {
        log.info("Fetching random record for user: {}, genre: {}, unplayedOnly: {}", user.getUsername(), genre, unplayedOnly);
        List<com.antigravity.vinyltracker.model.CollectionItem> candidates = collectionItemRepository.findCandidatesForRandom(user, unplayedOnly);

        if (genre != null && !genre.isBlank()) {
            String gLower = genre.trim().toLowerCase();
            candidates = candidates.stream()
                    .filter(ci -> ci.getRecord() != null && ci.getRecord().getGenres() != null &&
                            ci.getRecord().getGenres().stream().anyMatch(g -> g.toLowerCase().contains(gLower)))
                    .toList();
        }

        if (candidates.isEmpty()) {
            return null;
        }

        int randomIndex = java.util.concurrent.ThreadLocalRandom.current().nextInt(candidates.size());
        com.antigravity.vinyltracker.model.CollectionItem selected = candidates.get(randomIndex);
        Long playCount = listenEventRepository.countByRecordAndUser(selected.getRecord(), user);
        return mapToCollectionRelease(selected, playCount);
    }

    public DiscogsDto.CollectionResponse getUnplayedCollection(AppUser user, int page, int perPage) {
        log.info("Fetching unplayed records for user: {}, page: {}, perPage: {}", user.getUsername(), page, perPage);
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "addedAt"));
        Page<com.antigravity.vinyltracker.model.CollectionItem> pagedResult = collectionItemRepository.findUnplayedByUser(user, pageable);

        List<DiscogsDto.CollectionRelease> releases = pagedResult.getContent().stream()
                .map(item -> mapToCollectionRelease(item, 0L))
                .toList();

        DiscogsDto.Pagination pagination = new DiscogsDto.Pagination();
        pagination.setItems((int) pagedResult.getTotalElements());
        pagination.setPage(page);
        pagination.setPerPage(perPage);
        pagination.setPages(pagedResult.getTotalPages());

        return new DiscogsDto.CollectionResponse(releases, pagination);
    }

    public List<DiscogsDto.CollectionRelease> getAllCollection(AppUser user) {
        List<com.antigravity.vinyltracker.model.CollectionItem> items = collectionItemRepository.findAllByUser(user);
        return items.stream().map(item -> {
            Long playCount = listenEventRepository.countByRecordAndUser(item.getRecord(), user);
            return mapToCollectionRelease(item, playCount);
        }).toList();
    }

    private DiscogsDto.CollectionRelease mapToCollectionRelease(com.antigravity.vinyltracker.model.CollectionItem item,
                                                                Long listenCount) {
        DiscogsDto.CollectionRelease release = new DiscogsDto.CollectionRelease();
        release.setId(item.getRecord().getDiscogsId());
        release.setInstanceId(item.getInstanceId());
        release.setListenCount(listenCount);
        if (item.getAddedAt() != null) {
            release.setDateAdded(item.getAddedAt().toString());
        }

        DiscogsDto.Release basicInfo = new DiscogsDto.Release();
        basicInfo.setId(item.getRecord().getDiscogsId());
        basicInfo.setTitle(item.getRecord().getTitle());
        basicInfo.setThumbUrl(item.getRecord().getThumbUrl());
        basicInfo.setCoverImage(item.getRecord().getThumbUrl());
        basicInfo.setGenres(item.getRecord().getGenres() == null
                ? List.of()
                : new ArrayList<>(item.getRecord().getGenres()));
        basicInfo.setStyles(List.of());

        DiscogsDto.Artist artist = new DiscogsDto.Artist();
        artist.setName(item.getRecord().getArtist());
        basicInfo.setArtists(List.of(artist));

        try {
            basicInfo.setYear(Integer.parseInt(item.getRecord().getYear()));
        } catch (NumberFormatException e) {
            basicInfo.setYear(0);
        }

        basicInfo.setLowestPrice(item.getRecord().getLowestPrice());

        String format = item.getRecord().getFormat() != null ? item.getRecord().getFormat() : "LP";
        basicInfo.setFormat(format);
        DiscogsDto.Format fmt = new DiscogsDto.Format();
        fmt.setName(format);
        basicInfo.setFormats(List.of(fmt));

        release.setBasicInformation(basicInfo);
        return release;
    }
}
