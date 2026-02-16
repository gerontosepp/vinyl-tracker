package com.antigravity.vinyltracker.repository;

import com.antigravity.vinyltracker.model.Record;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecordRepository extends JpaRepository<Record, Long> {
    Optional<Record> findByDiscogsId(Long discogsId);
}
