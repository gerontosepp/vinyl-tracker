package com.antigravity.vinyltracker.util;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class YearFilterParserTest {

    @Test
    void parseYears_NullOrEmpty_ShouldReturnEmptySet() {
        assertTrue(YearFilterParser.parseYears(null).isEmpty());
        assertTrue(YearFilterParser.parseYears("").isEmpty());
        assertTrue(YearFilterParser.parseYears("   ").isEmpty());
    }

    @Test
    void parseYears_SingleYear_ShouldReturnSingleElement() {
        Set<String> years = YearFilterParser.parseYears("1975");
        assertEquals(Set.of("1975"), years);
    }

    @Test
    void parseYears_MultipleSingleYears_ShouldReturnAll() {
        Set<String> years = YearFilterParser.parseYears("1970, 1971, 1975");
        assertEquals(Set.of("1970", "1971", "1975"), years);
    }

    @Test
    void parseYears_Range_ShouldExpandRange() {
        Set<String> years = YearFilterParser.parseYears("1970 - 1972");
        assertEquals(Set.of("1970", "1971", "1972"), years);
    }

    @Test
    void parseYears_MultipleRangesAndSingles_ShouldCombine() {
        Set<String> years = YearFilterParser.parseYears("1970, 1972-1974, 1980");
        assertEquals(Set.of("1970", "1972", "1973", "1974", "1980"), years);
    }

    @Test
    void parseYears_ReversedRange_ShouldNormalize() {
        Set<String> years = YearFilterParser.parseYears("1972-1970");
        assertEquals(Set.of("1970", "1971", "1972"), years);
    }

    @Test
    void parseYears_WithEnDashAndSemicolons() {
        Set<String> years = YearFilterParser.parseYears("1980–1982; 1985");
        assertEquals(Set.of("1980", "1981", "1982", "1985"), years);
    }

    @Test
    void parseYears_InvalidTokens_ShouldBeIgnored() {
        Set<String> years = YearFilterParser.parseYears("abc, 1975, invalid-range, 99");
        assertEquals(Set.of("1975"), years);
    }

    @Test
    void parseYears_ExcessiveRange_ShouldBeIgnoredForSafety() {
        Set<String> years = YearFilterParser.parseYears("1000 - 1500");
        assertTrue(years.isEmpty());
    }
}
