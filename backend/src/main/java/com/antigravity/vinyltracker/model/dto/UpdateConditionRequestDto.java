package com.antigravity.vinyltracker.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateConditionRequestDto {

    @JsonProperty("media_condition")
    private String mediaCondition;

    @JsonProperty("sleeve_condition")
    private String sleeveCondition;

    @JsonProperty("mediaCondition")
    public void setMediaConditionCamel(String condition) {
        if (this.mediaCondition == null) {
            this.mediaCondition = condition;
        }
    }

    @JsonProperty("sleeveCondition")
    public void setSleeveConditionCamel(String condition) {
        if (this.sleeveCondition == null) {
            this.sleeveCondition = condition;
        }
    }
}
