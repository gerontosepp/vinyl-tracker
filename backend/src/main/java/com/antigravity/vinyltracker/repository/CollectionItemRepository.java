package com.antigravity.vinyltracker.repository;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.CollectionItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CollectionItemRepository extends JpaRepository<CollectionItem, Long> {

        List<CollectionItem> findAllByUser(AppUser user);

        Page<CollectionItem> findAllByUser(AppUser user, Pageable pageable);

        Optional<CollectionItem> findByUserAndInstanceId(AppUser user, Long instanceId);

        long countByUser(AppUser user);

        void deleteAllByUser(AppUser user);

        // Custom query to fetch collection items with their listen counts, sorted by
        // listen count
        // Uses a LEFT JOIN to listen_event to accurately count plays even if 0.
        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "ORDER BY playCount DESC")
        Page<Object[]> findAllByUserOrderByPlayCountDesc(@Param("user") AppUser user, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "ORDER BY playCount ASC")
        Page<Object[]> findAllByUserOrderByPlayCountAsc(@Param("user") AppUser user, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<CollectionItem> searchByUserAndKeyword(@Param("user") AppUser user, @Param("search") String search,
                        Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount DESC")
        Page<Object[]> searchByUserAndKeywordOrderByPlayCountDesc(@Param("user") AppUser user,
                        @Param("search") String search, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount ASC")
        Page<Object[]> searchByUserAndKeywordOrderByPlayCountAsc(@Param("user") AppUser user,
                        @Param("search") String search, Pageable pageable);
}
