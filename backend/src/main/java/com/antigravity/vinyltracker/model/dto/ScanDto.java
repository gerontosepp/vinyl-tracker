package com.antigravity.vinyltracker.model.dto;

import lombok.Data;
import lombok.AllArgsConstructor;

public class ScanDto {

    @Data
    public static class Request {
        private String barcode;
    }

    @Data
    @AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class Result {
        private boolean success;
        private String message;
        private TrackedRecord record;
        private java.util.List<DiscogsMatch> discogsMatches;

        public Result(boolean success, String message, TrackedRecord record) {
            this(success, message, record, null);
        }
    }

    @Data
    @AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class DiscogsMatch {
        private Long id;
        private String title;
        private String year;
        private String thumbUrl;
        private String coverImage;
        private java.util.List<String> format;
        private String country;
    }

    @Data
    @AllArgsConstructor
    public static class TrackedRecord {
        private Long discogsId;
        private String title;
        private String artist;
        private String thumbUrl;
    }

    @Data
    @AllArgsConstructor
    public static class ResetResult {
        private boolean success;
        private String message;
        private long deletedCount;
    }
}
