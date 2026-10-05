package com.antigravity.vinyltracker.repository;

import com.antigravity.vinyltracker.model.ListenEvent;
import com.antigravity.vinyltracker.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ListenEventRepository extends JpaRepository<ListenEvent, Long> {
    List<ListenEvent> findByUserIdOrderByTimestampDesc(Long userId);

    List<ListenEvent> findByUserIdAndTimestampBetweenOrderByTimestampDesc(Long userId, LocalDateTime start,
            LocalDateTime end);

    @Query("SELECT le.record, COUNT(le) FROM ListenEvent le WHERE le.user.id = :userId GROUP BY le.record ORDER BY le.record.artist ASC")
    List<Object[]> findRecordsWithPlays(Long userId);

    Long countByRecordAndUser(com.antigravity.vinyltracker.model.Record record,
            com.antigravity.vinyltracker.model.AppUser user);

    java.util.Optional<ListenEvent> findFirstByRecordAndUserOrderByTimestampDesc(
            com.antigravity.vinyltracker.model.Record record,
            com.antigravity.vinyltracker.model.AppUser user);

    List<ListenEvent> findAllByRecordAndUserOrderByTimestampDesc(
            com.antigravity.vinyltracker.model.Record record,
            com.antigravity.vinyltracker.model.AppUser user);

    @Modifying
    @Query("DELETE FROM ListenEvent le WHERE le.user = :user")
    long deleteAllByUser(@Param("user") AppUser user);
}
