package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;

    public AnalyticsController(ListenEventRepository listenEventRepository, AppUserRepository userRepository) {
        this.listenEventRepository = listenEventRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/recent")
    public List<ListenEvent> getRecentListens(@RequestParam String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());
    }

    @GetMapping("/top")
    public List<TopRecordDto> getTopRecords(@RequestParam String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ListenEvent> events = listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());

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

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class TopRecordDto {
        private String title;
        private String artist;
        private String thumbUrl;
        private Long count;
    }
}
