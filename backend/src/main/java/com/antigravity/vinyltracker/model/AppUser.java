package com.antigravity.vinyltracker.model;

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

    @Column(name = "discogs_token")
    private String discogsToken;

    public AppUser(String username, String discogsUsername, String discogsToken) {
        this.username = username;
        this.discogsUsername = discogsUsername;
        this.discogsToken = discogsToken;
    }
}
