package com.antigravity.vinyltracker.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoonPlayRequestDto {
    @NotBlank(message = "Artist must not be blank")
    private String artist;

    @NotBlank(message = "Title must not be blank")
    private String title;

    private String zoneId;
}
