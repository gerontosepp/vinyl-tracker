package com.antigravity.vinyltracker.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TopRecordDto {
    private String title;
    private String artist;
    private String thumbUrl;
    private Long count;
}
