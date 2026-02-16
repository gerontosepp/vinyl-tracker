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

    @Column(name = "discogs_token", columnDefinition = "TEXT")
    private String discogsToken;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String salt;

    public AppUser(String username, String password, String salt) {
        this.username = username;
        this.password = password;
        this.salt = salt;
    }
}
