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

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class CollectionResponse {
        @JsonProperty("releases")
        private List<CollectionRelease> releases;
        @JsonProperty("pagination")
        private Pagination pagination;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Pagination {
        private int items;
        private int page;
        private int pages;
        @JsonProperty("per_page")
        private int perPage;
        private Urls urls;

        @Data
        @lombok.AllArgsConstructor
        @lombok.NoArgsConstructor
        public static class Urls {
            private String next;
            private String prev;
        }
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class CollectionRelease {
        private Long id;
        @JsonProperty("instance_id")
        private Long instanceId;
        @JsonProperty("listen_count")
        private long listenCount;
        @JsonProperty("date_added")
        private String dateAdded;
        private int rating;
        @JsonProperty("basic_information")
        private BasicInformation basicInformation;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class BasicInformation {
        private Long id;
        private String title;
        private int year;
        @JsonProperty("thumb")
        private String thumbUrl;
        @JsonProperty("cover_image")
        private String coverImage;
        private List<Artist> artists;
        private List<Label> labels;
        private List<String> genres;
        private List<String> styles;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class ValueResponse {
        private ValueData minimum;
        private ValueData median;
        private ValueData maximum;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class ValueData {
        private String currency;
        private Double value;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Label {
        private String name;
        @JsonProperty("catno")
        private String catno;
        @JsonProperty("entity_type_name")
        private String entityTypeName;
        private Long id;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class QrCodeRequest {
        private List<QrCodeItem> items;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class QrCodeItem {
        private Long id;
        private String title;
        private String artist;
    }
}
