package com.antigravity.vinyltracker.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class JacksonConfigTest {

    private ObjectMapper objectMapper;

    static class TestDto {
        public LocalDateTime timestamp;

        public TestDto() {}
        public TestDto(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }
    }

    @BeforeEach
    void setUp() {
        JacksonConfig jacksonConfig = new JacksonConfig();
        objectMapper = jacksonConfig.objectMapper();
    }

    @Test
    void shouldSerializeLocalDateTimeWithZSuffix() throws Exception {
        LocalDateTime dt = LocalDateTime.of(2026, 10, 12, 22, 42, 22);
        TestDto dto = new TestDto(dt);

        String json = objectMapper.writeValueAsString(dto);
        assertEquals("{\"timestamp\":\"2026-10-12T22:42:22Z\"}", json);
    }

    @Test
    void shouldDeserializeLocalDateTimeWithZSuffix() throws Exception {
        String json = "{\"timestamp\":\"2026-10-12T22:42:22Z\"}";
        TestDto dto = objectMapper.readValue(json, TestDto.class);

        assertEquals(LocalDateTime.of(2026, 10, 12, 22, 42, 22), dto.timestamp);
    }

    @Test
    void shouldDeserializeLocalDateTimeWithoutZSuffix() throws Exception {
        String json = "{\"timestamp\":\"2026-10-12T22:42:22\"}";
        TestDto dto = objectMapper.readValue(json, TestDto.class);

        assertEquals(LocalDateTime.of(2026, 10, 12, 22, 42, 22), dto.timestamp);
    }

    @Test
    void shouldHandleNullValues() throws Exception {
        TestDto dto = new TestDto(null);
        String json = objectMapper.writeValueAsString(dto);
        assertEquals("{\"timestamp\":null}", json);

        TestDto deserialized = objectMapper.readValue("{\"timestamp\":null}", TestDto.class);
        assertNull(deserialized.timestamp);
    }
}
