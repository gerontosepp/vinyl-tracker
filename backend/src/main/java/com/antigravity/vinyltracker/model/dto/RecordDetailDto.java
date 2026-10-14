package com.antigravity.vinyltracker.model.dto;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RecordDetailDto {
    private Long id;
    @JsonProperty("discogs_id")
    private Long discogsId;
    private String title;
    private String artist;
    private String year;
    @JsonProperty("thumb_url")
    private String thumbUrl;
    private List<String> genres;
    @JsonProperty("in_collection")
    private boolean inCollection;
    @JsonProperty("instance_id")
    private Long instanceId;
    @JsonProperty("listen_count")
    private Long listenCount;
    @JsonProperty("last_listened_at")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime lastListenedAt;
    @JsonProperty("added_at")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime addedAt;
    @JsonProperty("media_condition")
    private String mediaCondition;
    @JsonProperty("sleeve_condition")
    private String sleeveCondition;
    @JsonProperty("lowest_price")
    private BigDecimal lowestPrice;
    @JsonProperty("median_price")
    private BigDecimal medianPrice;
    @JsonProperty("num_for_sale")
    private Integer numForSale;
    @JsonProperty("listen_history")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private List<LocalDateTime> listenHistory;
    private List<DiscogsDto.Track> tracklist;
    private String format;
    private List<DiscogsDto.Format> formats;
    private List<DiscogsDto.Label> labels;
    private String notes;
    private String country;
    private String released;
}
