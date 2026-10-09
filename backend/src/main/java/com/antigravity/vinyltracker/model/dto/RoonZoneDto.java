package com.antigravity.vinyltracker.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoonZoneDto {
    private String zoneId;
    private String name;
    private String state;
}
