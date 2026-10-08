package com.antigravity.vinyltracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "app_user")
@Data
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(name = "discogs_username")
    private String discogsUsername;

    @JsonIgnore
    @Column(name = "discogs_token", columnDefinition = "TEXT")
    private String discogsToken;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(name = "roon_host")
    private String roonHost;

    @Column(name = "roon_port")
    private Integer roonPort = 9100;

    @Column(name = "roon_zone_id")
    private String roonZoneId;

    @Column(name = "roon_zone_name")
    private String roonZoneName;

    @JsonIgnore
    @Column(name = "roon_token", columnDefinition = "TEXT")
    private String roonToken;

    public AppUser(String username, String password) {
        this.username = username;
        this.password = password;
    }
}
