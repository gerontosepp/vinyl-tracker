package com.antigravity.vinyltracker.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "record_cache", indexes = {
        @Index(name = "idx_record_cache_discogs", columnList = "discogs_id")
}) // 'record' is sometimes a reserved word or confusing in Java 14+
@Data
@NoArgsConstructor
public class Record {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private Long discogsId;

    private String title;
    private String artist;
    @Column(name = "release_year")
    private String year;
    private String thumbUrl;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "record_genres", joinColumns = @JoinColumn(name = "record_id"))
    @Column(name = "genre")
    @org.hibernate.annotations.BatchSize(size = 50)
    private List<String> genres = new ArrayList<>();

    public Record(Long discogsId, String title, String artist, String year, String thumbUrl) {
        this.discogsId = discogsId;
        this.title = title;
        this.artist = artist;
        this.year = year;
        this.thumbUrl = thumbUrl;
    }
}
