package com.antigravity.vinyltracker.repository;

import com.antigravity.vinyltracker.model.ListenEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ListenEventRepository extends JpaRepository<ListenEvent, Long> {
    List<ListenEvent> findByUserIdOrderByTimestampDesc(Long userId);

    List<ListenEvent> findByUserIdAndTimestampBetweenOrderByTimestampDesc(Long userId, LocalDateTime start,
            LocalDateTime end);
}
