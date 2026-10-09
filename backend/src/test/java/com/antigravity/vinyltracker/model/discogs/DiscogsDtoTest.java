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

    @Test
    void testDetermineFormat_DoubleCd_ReturnsDoubleCd() {
        // Multi-disc CD with qty >= 2 (e.g. Zappa - You Can't Do That On Stage Anymore)
        DiscogsDto.Format cdQty2 = new DiscogsDto.Format("CD", "2", List.of("Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdQty2))).isEqualTo("Double CD");

        // 3xCD (e.g. Zappa - Funky Nothingness)
        DiscogsDto.Format cdQty3 = new DiscogsDto.Format("CD", "3", List.of("Album", "Stereo"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdQty3))).isEqualTo("Double CD");

        // CD with 2xCD description
        DiscogsDto.Format cdDesc2x = new DiscogsDto.Format("CD", "1", List.of("2xCD", "Album"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdDesc2x))).isEqualTo("Double CD");

        // CD with Double CD description
        DiscogsDto.Format cdDoubleDesc = new DiscogsDto.Format("CD", "1", List.of("Double CD"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdDoubleDesc))).isEqualTo("Double CD");

        // Multiple CD format entries summing to >= 2
        DiscogsDto.Format cdEntry1 = new DiscogsDto.Format("CD", "1", List.of("Album"), "");
        DiscogsDto.Format cdEntry2 = new DiscogsDto.Format("CD", "1", List.of("Bonus CD"), "");
        assertThat(DiscogsDto.determineFormat(List.of(cdEntry1, cdEntry2))).isEqualTo("Double CD");
    }
}
