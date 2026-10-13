package com.antigravity.vinyltracker.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceRefreshResultDto {

    private int updatedCount;
    private int totalCount;
    private String message;
}
