package com.antigravity.vinyltracker.util;

import java.util.Collections;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YearFilterParser {

    private static final Pattern RANGE_PATTERN = Pattern.compile("^\\s*(\\d{4})\\s*[-–—]\\s*(\\d{4})\\s*$");
    private static final Pattern SINGLE_PATTERN = Pattern.compile("^\\s*(\\d{4})\\s*$");

    private YearFilterParser() {}

    /**
     * Parses a string containing single years and/or year ranges into a set of discrete 4-digit year strings.
     * Examples:
     * - "1970, 1971" -> ["1970", "1971"]
     * - "1970 - 1972" -> ["1970", "1971", "1972"]
     * - "1970, 1972-1974, 1980" -> ["1970", "1972", "1973", "1974", "1980"]
     *
     * @param input Raw input string (e.g. from query parameter)
     * @return Set of matching year strings, sorted ascending, or empty set if input is blank/invalid.
     */
    public static Set<String> parseYears(String input) {
        if (input == null || input.isBlank()) {
            return Collections.emptySet();
        }

        Set<String> result = new TreeSet<>();
        String[] parts = input.split("[,;]+");
        for (String rawPart : parts) {
            String part = rawPart.trim();
            if (part.isEmpty()) {
                continue;
            }

            Matcher rangeMatcher = RANGE_PATTERN.matcher(part);
            if (rangeMatcher.matches()) {
                int start = Integer.parseInt(rangeMatcher.group(1));
                int end = Integer.parseInt(rangeMatcher.group(2));
                int min = Math.min(start, end);
                int max = Math.max(start, end);

                // Bound max range to 300 years to prevent excessive memory usage
                if (max - min <= 300) {
                    for (int y = min; y <= max; y++) {
                        result.add(String.valueOf(y));
                    }
                }
                continue;
            }

            Matcher singleMatcher = SINGLE_PATTERN.matcher(part);
            if (singleMatcher.matches()) {
                result.add(singleMatcher.group(1));
            }
        }

        return result;
    }
}
