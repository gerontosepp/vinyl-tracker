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
    public List<Map.Entry<String, Long>> getTopRecords(@RequestParam String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ListenEvent> events = listenEventRepository.findByUserIdOrderByTimestampDesc(user.getId());

        // Simple in-memory aggregation for MVP. For production, use JPQL/SQL GROUP BY.
        Map<String, Long> counts = events.stream()
                .collect(Collectors.groupingBy(e -> e.getRecord().getTitle(), Collectors.counting()));

        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .collect(Collectors.toList());
    }
}
