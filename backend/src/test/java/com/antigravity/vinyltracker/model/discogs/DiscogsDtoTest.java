package com.antigravity.vinyltracker.model.discogs;

import org.junit.jupiter.api.Test;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DiscogsDtoTest {

    @Test
    void testDetermineFormat_NullOrEmpty_ReturnsLp() {
        assertThat(DiscogsDto.determineFormat(null)).isEqualTo("LP");
        assertThat(DiscogsDto.determineFormat(List.of())).isEqualTo("LP");
    }

    @Test
    void testDetermineFormat_StandardVinylLp_ReturnsLp() {
        DiscogsDto.Format format = new DiscogsDto.Format("Vinyl", "1", List.of("LP", "Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(format))).isEqualTo("LP");
    }

    @Test
    void testDetermineFormat_DoubleVinylLp_ReturnsDoubleLp() {
        DiscogsDto.Format formatQty2 = new DiscogsDto.Format("Vinyl", "2", List.of("LP", "Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(formatQty2))).isEqualTo("Double LP");

        DiscogsDto.Format formatDesc2x = new DiscogsDto.Format("Vinyl", "1", List.of("2xLP", "Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(formatDesc2x))).isEqualTo("Double LP");

        DiscogsDto.Format formatDoubleDesc = new DiscogsDto.Format("Vinyl", "1", List.of("Double LP"), "");
        assertThat(DiscogsDto.determineFormat(List.of(formatDoubleDesc))).isEqualTo("Double LP");
    }

    @Test
    void testDetermineFormat_Cd_ReturnsCd() {
        DiscogsDto.Format cdFormat = new DiscogsDto.Format("CD", "1", List.of("Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdFormat))).isEqualTo("CD");

        DiscogsDto.Format cdrFormat = new DiscogsDto.Format("CDr", "1", List.of(), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdrFormat))).isEqualTo("CD");
    }
}
