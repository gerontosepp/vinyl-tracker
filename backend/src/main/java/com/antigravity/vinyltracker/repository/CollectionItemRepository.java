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

        Optional<CollectionItem> findByUserAndRecord(AppUser user, com.antigravity.vinyltracker.model.Record record);

        Optional<CollectionItem> findByUserAndRecord_DiscogsId(AppUser user, Long discogsId);

        long countByUser(AppUser user);

        void deleteAllByUser(AppUser user);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user AND NOT EXISTS (SELECT le FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user)")
        Page<CollectionItem> findUnplayedByUser(@Param("user") AppUser user, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:unplayedOnly = false OR NOT EXISTS (SELECT le FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user))")
        List<CollectionItem> findCandidatesForRandom(@Param("user") AppUser user, @Param("unplayedOnly") boolean unplayedOnly);


        // Custom query to fetch collection items with their listen counts, sorted by
        // listen count
        // Uses a LEFT JOIN to listen_event to accurately count plays even if 0.
        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "ORDER BY playCount DESC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findAllByUserOrderByPlayCountDesc(@Param("user") AppUser user, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "ORDER BY playCount ASC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findAllByUserOrderByPlayCountAsc(@Param("user") AppUser user, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<CollectionItem> searchByUserAndKeyword(@Param("user") AppUser user, @Param("search") String search,
                        Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount DESC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> searchByUserAndKeywordOrderByPlayCountDesc(@Param("user") AppUser user,
                        @Param("search") String search, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount ASC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> searchByUserAndKeywordOrderByPlayCountAsc(@Param("user") AppUser user,
                        @Param("search") String search, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%')))")
        Page<CollectionItem> findAllByUserAndCategory(@Param("user") AppUser user, @Param("category") String category, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                "AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<CollectionItem> searchByUserAndCategoryAndKeyword(@Param("user") AppUser user, @Param("category") String category, @Param("search") String search,
                        Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                        "ORDER BY playCount DESC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findAllByUserAndCategoryOrderByPlayCountDesc(@Param("user") AppUser user, @Param("category") String category, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                        "ORDER BY playCount ASC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findAllByUserAndCategoryOrderByPlayCountAsc(@Param("user") AppUser user, @Param("category") String category, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                        "AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount DESC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> searchByUserAndCategoryAndKeywordOrderByPlayCountDesc(@Param("user") AppUser user,
                        @Param("category") String category, @Param("search") String search, Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount "
                        +
                        "FROM CollectionItem ci WHERE ci.user = :user " +
                        "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                        "AND (LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) "
                        +
                        "ORDER BY playCount ASC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> searchByUserAndCategoryAndKeywordOrderByPlayCountAsc(@Param("user") AppUser user,
                        @Param("category") String category, @Param("search") String search, Pageable pageable);

        @Query("SELECT ci FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                "AND (:hasSearch = false OR LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                "AND (:hasGenres = false OR EXISTS (SELECT 1 FROM ci.record.genres g WHERE LOWER(g) IN (:genres))) " +
                "AND (:hasYears = false OR ci.record.year IN (:years))")
        Page<CollectionItem> findFilteredCollection(
                @Param("user") AppUser user,
                @Param("category") String category,
                @Param("hasSearch") boolean hasSearch,
                @Param("search") String search,
                @Param("hasGenres") boolean hasGenres,
                @Param("genres") java.util.Collection<String> genres,
                @Param("hasYears") boolean hasYears,
                @Param("years") java.util.Collection<String> years,
                Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount " +
                "FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                "AND (:hasSearch = false OR LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                "AND (:hasGenres = false OR EXISTS (SELECT 1 FROM ci.record.genres g WHERE LOWER(g) IN (:genres))) " +
                "AND (:hasYears = false OR ci.record.year IN (:years)) " +
                "ORDER BY playCount DESC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findFilteredCollectionOrderByPlayCountDesc(
                @Param("user") AppUser user,
                @Param("category") String category,
                @Param("hasSearch") boolean hasSearch,
                @Param("search") String search,
                @Param("hasGenres") boolean hasGenres,
                @Param("genres") java.util.Collection<String> genres,
                @Param("hasYears") boolean hasYears,
                @Param("years") java.util.Collection<String> years,
                Pageable pageable);

        @Query(value = "SELECT ci, (SELECT COUNT(le) FROM ListenEvent le WHERE le.record = ci.record AND le.user = ci.user) as playCount " +
                "FROM CollectionItem ci WHERE ci.user = :user " +
                "AND (:category = 'all' OR (:category = 'cd' AND UPPER(ci.record.format) LIKE '%CD%') OR (:category = 'vinyl' AND (ci.record.format IS NULL OR UPPER(ci.record.format) NOT LIKE '%CD%'))) " +
                "AND (:hasSearch = false OR LOWER(ci.record.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(ci.record.title) LIKE LOWER(CONCAT('%', :search, '%'))) " +
                "AND (:hasGenres = false OR EXISTS (SELECT 1 FROM ci.record.genres g WHERE LOWER(g) IN (:genres))) " +
                "AND (:hasYears = false OR ci.record.year IN (:years)) " +
                "ORDER BY playCount ASC, ci.record.artist ASC, ci.record.year ASC")
        Page<Object[]> findFilteredCollectionOrderByPlayCountAsc(
                @Param("user") AppUser user,
                @Param("category") String category,
                @Param("hasSearch") boolean hasSearch,
                @Param("search") String search,
                @Param("hasGenres") boolean hasGenres,
                @Param("genres") java.util.Collection<String> genres,
                @Param("hasYears") boolean hasYears,
                @Param("years") java.util.Collection<String> years,
                Pageable pageable);
}
