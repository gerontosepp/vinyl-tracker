package com.antigravity.vinyltracker.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "collection_item", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "user_id", "instance_id" })
}, indexes = {
        @Index(name = "idx_collection_item_user", columnList = "user_id")
})
@Data
@NoArgsConstructor
public class CollectionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "record_id", nullable = false)
    private Record record;

    @Column(name = "instance_id", nullable = false)
    private Long instanceId; // Discogs instance_id, unique per user's collection

    @Column(name = "added_at", nullable = false)
    private LocalDateTime addedAt;

    public CollectionItem(AppUser user, Record record, Long instanceId) {
        this.user = user;
        this.record = record;
        this.instanceId = instanceId;
        this.addedAt = LocalDateTime.now();
    }
}
