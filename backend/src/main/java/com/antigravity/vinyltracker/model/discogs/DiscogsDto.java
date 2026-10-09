package com.antigravity.vinyltracker.model.discogs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.math.BigDecimal;
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
        @JsonProperty("cover_image")
        private String coverImage;
        private List<Track> tracklist;
        private List<Format> formats;
        private List<Label> labels;
        private String notes;
        private String country;
        private String released;
        private List<String> genres;
        private List<String> styles;
        private String format;
        @JsonProperty("lowest_price")
        private BigDecimal lowestPrice;
        @JsonProperty("num_for_sale")
        private Integer numForSale;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Track {
        private String position;
        private String title;
        private String duration;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Format {
        private String name;
        private String qty;
        private List<String> descriptions;
        private String text;
    }

    public static String determineFormat(List<Format> formats) {
        if (formats == null || formats.isEmpty()) {
            return "LP";
        }
        boolean hasCd = false;
        boolean hasDoubleCd = false;
        boolean hasVinyl = false;
        boolean hasDoubleLp = false;
        int cdQty = 0;
        int vinylQty = 0;

        for (Format f : formats) {
            String name = f.getName() != null ? f.getName().toLowerCase().trim() : "";
            String qtyStr = f.getQty() != null ? f.getQty().trim() : "1";
            int qty = 1;
            try {
                qty = Integer.parseInt(qtyStr);
            } catch (NumberFormatException ignored) {}

            List<String> descs = f.getDescriptions() != null ? f.getDescriptions() : List.of();

            boolean isCd = name.contains("cd") || descs.stream().anyMatch(d -> {
                String ld = d.toLowerCase();
                return ld.equals("cd") || ld.equals("cdr") || ld.equals("cd-r")
                        || ld.contains("compact disc") || ld.contains("2xcd") || ld.contains("2 x cd")
                        || ld.contains("double cd");
            });

            boolean isVinyl = name.contains("vinyl") || descs.stream().anyMatch(d -> {
                String ld = d.toLowerCase();
                return ld.contains("lp") || ld.contains("vinyl") || ld.contains("12\"") || ld.contains("7\"") || ld.contains("10\"");
            });

            boolean descHas2xCd = descs.stream().anyMatch(d -> {
                String ld = d.toLowerCase();
                return ld.contains("2xcd") || ld.contains("2 x cd") || ld.contains("2cd")
                        || ld.contains("double cd") || ld.contains("2 x compact disc");
            });

            boolean descHas2xVinyl = descs.stream().anyMatch(d -> {
                String ld = d.toLowerCase();
                return ld.contains("2xlp") || ld.contains("2 x lp") || ld.contains("2lp")
                        || ld.contains("double lp") || ld.contains("2 x vinyl") || ld.contains("2xvinyl");
            });

            if (isCd) {
                hasCd = true;
                cdQty += qty;
                if (qty >= 2 || descHas2xCd) {
                    hasDoubleCd = true;
                }
            }

            if (isVinyl) {
                hasVinyl = true;
                vinylQty += qty;
                if (qty >= 2 || descHas2xVinyl) {
                    hasDoubleLp = true;
                }
            } else if (!isCd && (descHas2xVinyl || qty >= 2)) {
                vinylQty += qty;
                hasDoubleLp = true;
            }
        }

        if (cdQty >= 2) {
            hasDoubleCd = true;
        }
        if (vinylQty >= 2) {
            hasDoubleLp = true;
        }

        if (hasDoubleCd && !hasVinyl) {
            return "Double CD";
        }
        if (hasDoubleLp) {
            return "Double LP";
        }
        if (hasDoubleCd) {
            return "Double CD";
        }
        if (hasCd && !hasVinyl) {
            return "CD";
        }
        if (hasVinyl) {
            return "LP";
        }
        if (hasCd) {
            return "CD";
        }
        return "LP";
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
        private Pagination pagination;
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
        private List<String> genre;
        private List<String> style;
        private List<String> format;
        private String country;
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
        private Release basicInformation;
    }

    @Deprecated
    @JsonIgnoreProperties(ignoreUnknown = true)
    @Data
    @lombok.EqualsAndHashCode(callSuper = true)
    @lombok.NoArgsConstructor
    public static class BasicInformation extends Release {
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
        @jakarta.validation.constraints.NotEmpty(message = "Items list must not be empty")
        @jakarta.validation.Valid
        private List<QrCodeItem> items;
    }

    @Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class QrCodeItem {
        @jakarta.validation.constraints.NotNull(message = "Record ID must not be null")
        private Long id;
        @jakarta.validation.constraints.NotBlank(message = "Title must not be blank")
        private String title;
        private String artist;
    }
}
