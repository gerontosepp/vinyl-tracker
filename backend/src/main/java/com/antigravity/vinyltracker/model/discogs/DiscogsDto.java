package com.antigravity.vinyltracker.model.discogs;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

public class DiscogsDto {

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Release {
        private Long id;
        private String title;
        private List<Artist> artists;
        private int year;
        @JsonProperty("thumb")
        private String thumbUrl;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Artist {
        private String name;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class SearchResponse {
        private List<SearchResult> results;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class SearchResult {
        private Long id;
        private String title;
        private String year;
        @JsonProperty("thumb")
        private String thumbUrl;
        @JsonProperty("cover_image")
        private String coverImage;
        private List<String> barcode;
    }
}
