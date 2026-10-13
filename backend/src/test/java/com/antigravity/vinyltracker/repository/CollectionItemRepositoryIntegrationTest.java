package com.antigravity.vinyltracker.repository;

import com.antigravity.vinyltracker.AbstractIntegrationTest;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.Record;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Transactional
class CollectionItemRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CollectionItemRepository collectionItemRepository;

    @Autowired
    private RecordRepository recordRepository;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ListenEventRepository listenEventRepository;

    private AppUser testUser;
    private Record unplayedRecord;
    private Record playedOldRecord;
    private Record playedRecentRecord;

    @BeforeEach
    void setUp() {
        testUser = userRepository.save(new AppUser("filtertester", "pw"));

        unplayedRecord = new Record(101L, "Never Played", "Band A", "1990", null);
        unplayedRecord.setFormat("Vinyl");
        unplayedRecord = recordRepository.save(unplayedRecord);

        playedOldRecord = new Record(102L, "Played Long Ago", "Band B", "1995", null);
        playedOldRecord.setFormat("Vinyl");
        playedOldRecord = recordRepository.save(playedOldRecord);

        playedRecentRecord = new Record(103L, "Played Recently", "Band C", "2000", null);
        playedRecentRecord.setFormat("Vinyl");
        playedRecentRecord = recordRepository.save(playedRecentRecord);

        collectionItemRepository.save(new CollectionItem(testUser, unplayedRecord, 1L));
        collectionItemRepository.save(new CollectionItem(testUser, playedOldRecord, 2L));
        collectionItemRepository.save(new CollectionItem(testUser, playedRecentRecord, 3L));

        // Listen events:
        // playedOldRecord: played on 2026-01-15
        ListenEvent oldEvent = new ListenEvent(testUser, playedOldRecord);
        oldEvent.setTimestamp(LocalDateTime.of(2026, 1, 15, 12, 0));
        listenEventRepository.save(oldEvent);

        // playedRecentRecord: played on 2026-06-15
        ListenEvent recentEvent = new ListenEvent(testUser, playedRecentRecord);
        recentEvent.setTimestamp(LocalDateTime.of(2026, 6, 15, 12, 0));
        listenEventRepository.save(recentEvent);
    }

    @Test
    void findFilteredCollection_WithNotPlayedSince_ReturnsUnplayedAndRecordsPlayedBeforeDate() {
        LocalDateTime cutoff = LocalDateTime.of(2026, 5, 1, 0, 0);
        Pageable pageable = PageRequest.of(0, 10);

        Page<CollectionItem> result = collectionItemRepository.findFilteredCollection(
                testUser, "all", false, "", false, List.of("__NONE__"), false, List.of("__NONE__"),
                false, 0, false, true, cutoff, pageable);

        assertEquals(2, result.getTotalElements());
        List<Long> recordIds = result.getContent().stream()
                .map(ci -> ci.getRecord().getDiscogsId())
                .toList();

        assertTrue(recordIds.contains(101L)); // unplayed
        assertTrue(recordIds.contains(102L)); // played before May 1, 2026
    }

    @Test
    void findFilteredCollection_WithUnplayedOnly_ReturnsOnlyRecordsWithZeroListens() {
        Pageable pageable = PageRequest.of(0, 10);

        Page<CollectionItem> result = collectionItemRepository.findFilteredCollection(
                testUser, "all", false, "", false, List.of("__NONE__"), false, List.of("__NONE__"),
                false, 0, true, false, LocalDateTime.of(1970, 1, 1, 0, 0), pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(101L, result.getContent().get(0).getRecord().getDiscogsId());
    }

    @Test
    void findFilteredCollectionOrderByPlayCountDesc_WithNotPlayedSince() {
        LocalDateTime cutoff = LocalDateTime.of(2026, 5, 1, 0, 0);
        Pageable pageable = PageRequest.of(0, 10);

        Page<Object[]> result = collectionItemRepository.findFilteredCollectionOrderByPlayCountDesc(
                testUser, "all", false, "", false, List.of("__NONE__"), false, List.of("__NONE__"),
                false, 0, false, true, cutoff, pageable);

        assertEquals(2, result.getTotalElements());
        // First should be playedOldRecord (1 play), then unplayedRecord (0 plays)
        CollectionItem first = (CollectionItem) result.getContent().get(0)[0];
        CollectionItem second = (CollectionItem) result.getContent().get(1)[0];
        assertEquals(102L, first.getRecord().getDiscogsId());
        assertEquals(101L, second.getRecord().getDiscogsId());
    }
}
