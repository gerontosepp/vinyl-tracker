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

    @org.springframework.data.jpa.repository.Query("SELECT le.record, COUNT(le) FROM ListenEvent le WHERE le.user.id = :userId GROUP BY le.record ORDER BY le.record.artist ASC")
    List<Object[]> findRecordsWithPlays(Long userId);
}
