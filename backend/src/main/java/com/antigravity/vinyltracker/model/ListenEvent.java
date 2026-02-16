package com.antigravity.vinyltracker.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "listen_event")
@Data
@NoArgsConstructor
public class ListenEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "record_id", nullable = false)
    private Record record;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public ListenEvent(AppUser user, Record record) {
        this.user = user;
        this.record = record;
        this.timestamp = LocalDateTime.now();
    }
}
