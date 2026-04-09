package com.antigravity.vinyltracker;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.flyway.enabled=true",
                "spring.flyway.locations=classpath:db/migration",
                "spring.jpa.hibernate.ddl-auto=validate",
                "logging.level.org.flywaydb=INFO"
        }
)
class FlywayMigrationIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger(FlywayMigrationIntegrationTest.class);

    @Container
    static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.database-platform",
                () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayMigrationCreatesAllTables() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables " +
                        "WHERE table_schema = 'public' " +
                        "AND table_type = 'BASE TABLE' " +
                        "ORDER BY table_name",
                String.class
        );

        log.info("Found tables: {}", tables);

        assertTrue(tables.contains("app_user"), "app_user table should exist");
        assertTrue(tables.contains("record_cache"), "record_cache table should exist");
        assertTrue(tables.contains("record_genres"), "record_genres table should exist");
        assertTrue(tables.contains("collection_item"), "collection_item table should exist");
        assertTrue(tables.contains("listen_event"), "listen_event table should exist");
        assertTrue(tables.contains("flyway_schema_history"),
                "flyway_schema_history table should exist");
    }

    @Test
    void flywaySchemaHistoryContainsInitialMigration() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history " +
                        "WHERE script = 'V1__initial_schema.sql' AND success = true",
                Integer.class
        );

        assertNotNull(count);
        assertEquals(1, count, "V1 migration should be recorded as successful");
    }
}
