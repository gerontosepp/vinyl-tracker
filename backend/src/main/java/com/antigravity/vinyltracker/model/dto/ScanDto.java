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
    public static class Result {
        private boolean success;
        private String message;
        private TrackedRecord record;
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
