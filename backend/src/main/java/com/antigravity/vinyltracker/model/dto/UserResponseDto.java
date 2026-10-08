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
    private String token;
    private String roonHost;
    private Integer roonPort;
    private String roonZoneId;
    private String roonZoneName;
    private Boolean roonPaired;

    public static UserResponseDto fromEntity(AppUser user, String token) {
        UserResponseDto dto = new UserResponseDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setDiscogsUsername(user.getDiscogsUsername());
        dto.setToken(token);
        dto.setRoonHost(user.getRoonHost());
        dto.setRoonPort(user.getRoonPort());
        dto.setRoonZoneId(user.getRoonZoneId());
        dto.setRoonZoneName(user.getRoonZoneName());
        dto.setRoonPaired(user.getRoonToken() != null && !user.getRoonToken().isBlank());
        return dto;
    }

    public static UserResponseDto fromEntity(AppUser user) {
        return fromEntity(user, null);
    }
}
