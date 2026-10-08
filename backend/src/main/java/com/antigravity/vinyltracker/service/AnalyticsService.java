package com.antigravity.vinyltracker.service;
 
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.CollectionItem;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import com.antigravity.vinyltracker.repository.CollectionItemRepository;
import com.antigravity.vinyltracker.exception.DiscogsTokenException;
import org.springframework.stereotype.Service;
 
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.stream.Collectors;
 
import lombok.RequiredArgsConstructor;
 
@Service
@RequiredArgsConstructor
public class AnalyticsService {
 
    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;
    private final DiscogsApiClient discogsApiClient;
    private final CollectionItemRepository collectionItemRepository;
 
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<com.antigravity.vinyltracker.model.dto.ListenEventDto> getRecentListens(String username, LocalDate from, LocalDate to) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ListenEvent> events;
        if (from != null && to != null) {
            events = listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                    user.getId(),
                    from.atStartOfDay(),
                    to.atTime(java.time.LocalTime.MAX));
        } else {
            events = listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());
        }
        return events.stream().map(com.antigravity.vinyltracker.model.dto.ListenEventDto::from).toList();
    }
 
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<TopRecordDto> getTopRecords(String username, LocalDate from, LocalDate to) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
 
        List<ListenEvent> events;
        if (from != null && to != null) {
            events = listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                    user.getId(),
                    from.atStartOfDay(),
                    to.atTime(java.time.LocalTime.MAX));
        } else {
            events = listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());
        }
 
        // Group by Record entity to access all metadata including thumbUrl
        Map<com.antigravity.vinyltracker.model.Record, Long> counts = events.stream()
                .collect(Collectors.groupingBy(ListenEvent::getRecord, Collectors.counting()));
 
        return counts.entrySet().stream()
                .sorted(Map.Entry.<com.antigravity.vinyltracker.model.Record, Long>comparingByValue().reversed())
                .limit(10)
                .map(entry -> {
                    com.antigravity.vinyltracker.model.Record record = entry.getKey();
                    return new TopRecordDto(
                            record.getTitle(),
                            record.getArtist(),
                            record.getThumbUrl(),
                            entry.getValue());
                })
                .collect(Collectors.toList());
    }
 
    public DiscogsDto.ValueResponse getCollectionValue(String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
 
        if (user.getDiscogsToken() == null || user.getDiscogsToken().isEmpty()) {
            throw new DiscogsTokenException("Connect your Discogs account in settings before requesting collection value.");
        }
 
        return discogsApiClient.getCollectionValue(user);
    }
 
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Map<String, Object>> getGenreBreakdown(String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
 
        // Fetch all items from local DB
        List<CollectionItem> items = collectionItemRepository.findAllByUser(user);
 
        // Aggregate genres
        Map<String, Integer> genreCounts = new HashMap<>();
        for (CollectionItem item : items) {
            List<String> genres = item.getRecord().getGenres();
            if (genres != null && !genres.isEmpty()) {
                for (String genre : genres) {
                    genreCounts.put(genre, genreCounts.getOrDefault(genre, 0) + 1);
                }
            } else {
                genreCounts.put("Unknown", genreCounts.getOrDefault("Unknown", 0) + 1);
            }
        }
 
        return genreCounts.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue())) // Descending
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", entry.getKey());
                    map.put("value", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());
    }
}

