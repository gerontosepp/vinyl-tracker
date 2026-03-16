package com.antigravity.vinyltracker.model.discogs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DiscogsDto {

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Release {
        private Long id;
        private String title;
        private List<Artist> artists;
        private Integer year;
        @JsonProperty("thumb")
        private String thumbUrl;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Artist {
        private String name;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class SearchResponse {
        private List<SearchResult> results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class CollectionResponse {
        @JsonProperty("releases")
        private List<CollectionRelease> releases;
        @JsonProperty("pagination")
        private Pagination pagination;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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

        @JsonIgnoreProperties(ignoreUnknown = true)
        @Data
        @lombok.AllArgsConstructor
        @lombok.NoArgsConstructor
        public static class Urls {
            private String next;
            private String prev;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class CollectionRelease {
        private Long id;
        @JsonProperty("instance_id")
        private Long instanceId;
        @JsonProperty("listen_count")
        private Long listenCount;
        @JsonProperty("date_added")
        private String dateAdded;
        private Integer rating;
        @JsonProperty("basic_information")
        private BasicInformation basicInformation;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class BasicInformation {
        private Long id;
        private String title;
        private Integer year;
        @JsonProperty("thumb")
        private String thumbUrl;
        @JsonProperty("cover_image")
        private String coverImage;
        private List<Artist> artists;
        private List<Label> labels;
        private List<String> genres;
        private List<String> styles;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class ValueResponse {
        private ValueData minimum;
        private ValueData median;
        private ValueData maximum;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class ValueData {
        private String currency;
        private Double value;

        private static final Pattern NUMBER_PATTERN = Pattern.compile("(-?\\d[\\d,]*(?:\\.\\d+)?)");

        @JsonCreator
        public static ValueData fromJson(Object node) {
            if (node == null) {
                return new ValueData(null, 0.0);
            }

            if (node instanceof Map<?, ?> map) {
                String currency = map.get("currency") != null ? String.valueOf(map.get("currency")) : null;
                Double value = 0.0;
                Object rawValue = map.get("value");
                if (rawValue instanceof Number number) {
                    value = number.doubleValue();
                } else if (rawValue != null) {
                    try {
                        value = Double.parseDouble(String.valueOf(rawValue));
                    } catch (NumberFormatException ignored) {
                        value = 0.0;
                    }
                }
                return new ValueData(currency, value);
            }

            if (node instanceof String textNode) {
                String text = textNode.trim();
                Matcher matcher = NUMBER_PATTERN.matcher(text);

                if (!matcher.find()) {
                    return new ValueData(text.isEmpty() ? null : text, 0.0);
                }

                String rawNumber = matcher.group(1);
                double parsedValue = Double.parseDouble(rawNumber.replace(",", ""));
                String currency = text.replace(rawNumber, "").trim();
                return new ValueData(currency.isEmpty() ? null : currency, parsedValue);
            }

            if (node instanceof Number numberNode) {
                return new ValueData(null, numberNode.doubleValue());
            }

            return new ValueData(null, 0.0);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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
