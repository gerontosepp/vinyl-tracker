package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.model.dto.RecordDetailDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.RecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class RecordService {

    private final RecordRepository recordRepository;
    private final CollectionItemRepository collectionItemRepository;
    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;
    private final DiscogsApiClient discogsApiClient;

    @Transactional
    public RecordDetailDto getRecordDetails(Long id, String username) {
        log.info("Fetching record details for id: {} by user: {}", id, username);
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        Optional<Record> recordOpt = recordRepository.findById(id)
                .or(() -> recordRepository.findByDiscogsId(id));

        Long discogsId = recordOpt.map(Record::getDiscogsId).orElse(id);

        DiscogsDto.Release release = null;
        try {
            release = discogsApiClient.getRelease(discogsId, user);
        } catch (Exception e) {
            log.warn("Could not fetch Discogs release for ID: {}", discogsId, e);
        }

        if (recordOpt.isEmpty() && release == null) {
            throw new ResourceNotFoundException("Record not found with ID: " + id);
        }

        Optional<CollectionItem> collectionItemOpt = recordOpt
                .flatMap(r -> collectionItemRepository.findByUserAndRecord(user, r));
        if (collectionItemOpt.isEmpty()) {
            collectionItemOpt = collectionItemRepository.findByUserAndRecord_DiscogsId(user, discogsId);
        }

        Long listenCount = 0L;
        LocalDateTime lastListenedAt = null;
        List<LocalDateTime> listenHistory = List.of();
        if (recordOpt.isPresent()) {
            Record record = recordOpt.get();
            listenCount = listenEventRepository.countByRecordAndUser(record, user);
            lastListenedAt = listenEventRepository.findFirstByRecordAndUserOrderByTimestampDesc(record, user)
                    .map(ListenEvent::getTimestamp)
                    .orElse(null);
            listenHistory = listenEventRepository.findAllByRecordAndUserOrderByTimestampDesc(record, user)
                    .stream()
                    .map(ListenEvent::getTimestamp)
                    .toList();
        }

        Double lowestPrice = release != null && release.getLowestPrice() != null
                ? release.getLowestPrice()
                : (recordOpt.isPresent() ? recordOpt.get().getLowestPrice() : null);
        Integer numForSale = release != null ? release.getNumForSale() : null;

        if (release != null && release.getLowestPrice() != null && recordOpt.isPresent()) {
            Record r = recordOpt.get();
            if (r.getLowestPrice() == null || !r.getLowestPrice().equals(release.getLowestPrice())) {
                r.setLowestPrice(release.getLowestPrice());
                recordRepository.save(r);
            }
        }

        String title = release != null && release.getTitle() != null
                ? release.getTitle()
                : (recordOpt.isPresent() ? recordOpt.get().getTitle() : null);

        String artist = "Unknown";
        if (release != null && release.getArtists() != null && !release.getArtists().isEmpty()) {
            artist = release.getArtists().get(0).getName();
        } else if (recordOpt.isPresent() && recordOpt.get().getArtist() != null) {
            artist = recordOpt.get().getArtist();
        }

        String year = release != null && release.getYear() != null && release.getYear() > 0
                ? String.valueOf(release.getYear())
                : (recordOpt.isPresent() ? recordOpt.get().getYear() : null);

        String thumbUrl = release != null && release.getThumbUrl() != null
                ? release.getThumbUrl()
                : (recordOpt.isPresent() ? recordOpt.get().getThumbUrl() : null);

        List<String> genres = release != null && release.getGenres() != null
                ? release.getGenres()
                : (recordOpt.isPresent() && recordOpt.get().getGenres() != null ? recordOpt.get().getGenres() : List.of());

        return RecordDetailDto.builder()
                .id(recordOpt.map(Record::getId).orElse(null))
                .discogsId(discogsId)
                .title(title)
                .artist(artist)
                .year(year)
                .thumbUrl(thumbUrl)
                .genres(genres)
                .inCollection(collectionItemOpt.isPresent())
                .instanceId(collectionItemOpt.map(CollectionItem::getInstanceId).orElse(null))
                .addedAt(collectionItemOpt.map(CollectionItem::getAddedAt).orElse(null))
                .listenCount(listenCount != null ? listenCount : 0L)
                .lastListenedAt(lastListenedAt)
                .lowestPrice(lowestPrice)
                .numForSale(numForSale)
                .listenHistory(listenHistory)
                .tracklist(release != null && release.getTracklist() != null ? release.getTracklist() : List.of())
                .formats(release != null && release.getFormats() != null ? release.getFormats() : List.of())
                .labels(release != null && release.getLabels() != null ? release.getLabels() : List.of())
                .notes(release != null ? release.getNotes() : null)
                .country(release != null ? release.getCountry() : null)
                .released(release != null ? release.getReleased() : null)
                .build();
    }
}
