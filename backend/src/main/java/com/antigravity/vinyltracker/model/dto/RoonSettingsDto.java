package com.antigravity.vinyltracker.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoonSettingsDto {
    private String roonHost;

    @Min(1)
    @Max(65535)
    private Integer roonPort;

    private String roonZoneId;
    private String roonZoneName;
}
