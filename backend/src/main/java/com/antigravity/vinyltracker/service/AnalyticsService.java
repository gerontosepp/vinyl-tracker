package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.dto.TopRecordDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.repository.ListenEventRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final ListenEventRepository listenEventRepository;
    private final AppUserRepository userRepository;

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
}
