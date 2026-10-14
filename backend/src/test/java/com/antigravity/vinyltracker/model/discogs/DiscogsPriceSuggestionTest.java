package com.antigravity.vinyltracker.model.discogs;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DiscogsPriceSuggestionTest {

    @Test
    void extractSuggestedPrice_ExactMatch() {
        Map<String, DiscogsDto.PriceSuggestion> suggestions = new HashMap<>();
        suggestions.put("Mint (M)", new DiscogsDto.PriceSuggestion("EUR", 20.0));
        suggestions.put("Near Mint (NM or M-)", new DiscogsDto.PriceSuggestion("EUR", 15.5));
        suggestions.put("Very Good Plus (VG+)", new DiscogsDto.PriceSuggestion("EUR", 10.25));
        suggestions.put("Very Good (VG)", new DiscogsDto.PriceSuggestion("EUR", 7.0));

        BigDecimal price = DiscogsDto.extractSuggestedPrice(suggestions, "Near Mint (NM or M-)");
        assertNotNull(price);
        assertEquals(new BigDecimal("15.50"), price);
    }

    @Test
    void extractSuggestedPrice_ShortCodeMatching() {
        Map<String, DiscogsDto.PriceSuggestion> suggestions = new HashMap<>();
        suggestions.put("Mint (M)", new DiscogsDto.PriceSuggestion("EUR", 30.0));
        suggestions.put("Near Mint (NM or M-)", new DiscogsDto.PriceSuggestion("EUR", 25.0));
        suggestions.put("Very Good Plus (VG+)", new DiscogsDto.PriceSuggestion("EUR", 18.75));
        suggestions.put("Very Good (VG)", new DiscogsDto.PriceSuggestion("EUR", 12.0));

        BigDecimal priceVg = DiscogsDto.extractSuggestedPrice(suggestions, "VG");
        assertNotNull(priceVg);
        assertEquals(new BigDecimal("12.00"), priceVg);

        BigDecimal priceVgPlus = DiscogsDto.extractSuggestedPrice(suggestions, "VG+");
        assertNotNull(priceVgPlus);
        assertEquals(new BigDecimal("18.75"), priceVgPlus);

        BigDecimal priceNm = DiscogsDto.extractSuggestedPrice(suggestions, "NM");
        assertNotNull(priceNm);
        assertEquals(new BigDecimal("25.00"), priceNm);
    }

    @Test
    void extractSuggestedPrice_FallbackToVeryGoodPlusWhenConditionNullOrUnrecognized() {
        Map<String, DiscogsDto.PriceSuggestion> suggestions = new HashMap<>();
        suggestions.put("Mint (M)", new DiscogsDto.PriceSuggestion("EUR", 30.0));
        suggestions.put("Very Good Plus (VG+)", new DiscogsDto.PriceSuggestion("EUR", 16.50));

        // When condition is null
        BigDecimal fallbackNull = DiscogsDto.extractSuggestedPrice(suggestions, null);
        assertNotNull(fallbackNull);
        assertEquals(new BigDecimal("16.50"), fallbackNull);

        // When condition is empty string
        BigDecimal fallbackBlank = DiscogsDto.extractSuggestedPrice(suggestions, "   ");
        assertNotNull(fallbackBlank);
        assertEquals(new BigDecimal("16.50"), fallbackBlank);

        // When condition is unknown
        BigDecimal fallbackUnknown = DiscogsDto.extractSuggestedPrice(suggestions, "Unknown / Custom");
        assertNotNull(fallbackUnknown);
        assertEquals(new BigDecimal("16.50"), fallbackUnknown);
    }

    @Test
    void extractSuggestedPrice_EmptyOrNullMap() {
        assertNull(DiscogsDto.extractSuggestedPrice(null, "VG+"));
        assertNull(DiscogsDto.extractSuggestedPrice(Map.of(), "VG+"));
    }
}
