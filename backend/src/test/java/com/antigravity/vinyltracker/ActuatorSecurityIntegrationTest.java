package com.antigravity.vinyltracker;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.HttpClientErrorException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class ActuatorSecurityIntegrationTest extends AbstractIntegrationTest {

    @LocalServerPort
    private int port;

    private RestClient restClient;

    @BeforeEach
    void setUp() {
        restClient = RestClient.builder()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    @Test
    void healthEndpointShouldBePublic() {
        ResponseEntity<String> response = restClient.get()
                .uri("/actuator/health")
                .retrieve()
                .toEntity(String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void infoEndpointShouldBePublic() {
        ResponseEntity<String> response = restClient.get()
                .uri("/actuator/info")
                .retrieve()
                .toEntity(String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void metricsEndpointShouldBeRestricted() {
        HttpClientErrorException exception = assertThrows(HttpClientErrorException.class, () -> {
            restClient.get()
                    .uri("/actuator/metrics")
                    .retrieve()
                    .toBodilessEntity();
        });
        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void envEndpointShouldBeRestricted() {
        HttpClientErrorException exception = assertThrows(HttpClientErrorException.class, () -> {
            restClient.get()
                    .uri("/actuator/env")
                    .retrieve()
                    .toBodilessEntity();
        });
        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void configpropsEndpointShouldBeRestricted() {
        HttpClientErrorException exception = assertThrows(HttpClientErrorException.class, () -> {
            restClient.get()
                    .uri("/actuator/configprops")
                    .retrieve()
                    .toBodilessEntity();
        });
        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
