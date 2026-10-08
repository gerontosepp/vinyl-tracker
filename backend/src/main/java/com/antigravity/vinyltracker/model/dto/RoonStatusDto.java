package com.antigravity.vinyltracker.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoonStatusDto {
    private boolean connected;
    private boolean paired;
    private String coreName;
    private String coreId;
    private String host;
    private Integer port;
    private String selectedZoneId;
    private String selectedZoneName;
    @Builder.Default
    private List<RoonZoneDto> zones = new ArrayList<>();
}
