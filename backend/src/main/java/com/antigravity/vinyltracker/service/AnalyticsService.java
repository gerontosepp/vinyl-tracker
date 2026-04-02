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
 
    public List<ListenEvent> getRecentListens(String username, LocalDate from, LocalDate to) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
 
        if (from != null && to != null) {
            return listenEventRepository.findByUserIdAndTimestampBetweenOrderByTimestampDesc(
                    user.getId(),
                    from.atStartOfDay(),
                    to.atTime(java.time.LocalTime.MAX));
        }
        return listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());
    }
 
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
 
        List<Map<String, Object>> result = genreCounts.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue())) // Descending
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", entry.getKey());
                    map.put("value", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());
 
        if (result.size() > 5) {
            List<Map<String, Object>> top5 = new ArrayList<>(result.subList(0, 5));
            int otherCount = result.subList(5, result.size()).stream()
                    .mapToInt(m -> (Integer) m.get("value"))
                    .sum();
            
            if (otherCount > 0) {
               Map<String, Object> otherMap = new HashMap<>();
               otherMap.put("name", "Other");
               otherMap.put("value", otherCount);
               top5.add(otherMap);
            }
            return top5;
        }
 
        return result;
    }
}

