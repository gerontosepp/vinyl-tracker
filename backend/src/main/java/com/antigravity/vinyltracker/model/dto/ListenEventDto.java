package com.antigravity.vinyltracker.model.dto;

import com.antigravity.vinyltracker.model.ListenEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ListenEventDto {
    private Long id;
    private ScanDto.TrackedRecord record;
    private LocalDateTime timestamp;

    public static ListenEventDto from(ListenEvent event) {
        if (event == null) {
            return null;
        }
        ScanDto.TrackedRecord tracked = null;
        if (event.getRecord() != null) {
            tracked = new ScanDto.TrackedRecord(
                    event.getRecord().getDiscogsId(),
                    event.getRecord().getTitle(),
                    event.getRecord().getArtist(),
                    event.getRecord().getThumbUrl()
            );
        }
        return new ListenEventDto(event.getId(), tracked, event.getTimestamp());
    }
}
