package com.antigravity.vinyltracker.model.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateDiscogsRequestDto {
    @Size(max = 255)
    private String token;

    @Size(max = 128)
    private String discogsUsername;

    @Size(max = 128)
    private String password;
}