package com.antigravity.vinyltracker.model.dto;

import com.antigravity.vinyltracker.model.AppUser;
import lombok.Data;

/**
 * DTO for API responses that contain user data.
 * This ensures that sensitive fields (password hash, salt, discogs token)
 * are never exposed to the frontend.
 */
@Data
public class UserResponseDto {
    private Long id;
    private String username;
    private String discogsUsername;

    public static UserResponseDto fromEntity(AppUser user) {
        UserResponseDto dto = new UserResponseDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setDiscogsUsername(user.getDiscogsUsername());
        return dto;
    }
}
