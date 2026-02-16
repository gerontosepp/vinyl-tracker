package com.antigravity.vinyltracker.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "record_cache") // 'record' is sometimes a reserved word or confusing in Java 14+
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

    public Record(Long discogsId, String title, String artist, String year, String thumbUrl) {
        this.discogsId = discogsId;
        this.title = title;
        this.artist = artist;
        this.year = year;
        this.thumbUrl = thumbUrl;
    }
}
