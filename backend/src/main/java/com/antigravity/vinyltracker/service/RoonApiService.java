package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.exception.ResourceNotFoundException;
import com.antigravity.vinyltracker.exception.RoonApiException;
import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.model.dto.RoonPlayRequestDto;
import com.antigravity.vinyltracker.model.dto.RoonSettingsDto;
import com.antigravity.vinyltracker.model.dto.RoonStatusDto;
import com.antigravity.vinyltracker.model.dto.RoonZoneDto;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import com.antigravity.vinyltracker.service.roon.RoonClient;
import com.antigravity.vinyltracker.service.roon.RoonClientFactory;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoonApiService {

    private final AppUserRepository appUserRepository;
    private final RoonClientFactory roonClientFactory;

    private final Map<Long, RoonClient> clientSessions = new ConcurrentHashMap<>();

    public RoonStatusDto getStatus(String username) {
        AppUser user = getUserByUsername(username);
        if (user.getRoonHost() == null || user.getRoonHost().isBlank()) {
            return RoonStatusDto.builder()
                    .connected(false)
                    .paired(false)
                    .host(user.getRoonHost())
                    .port(user.getRoonPort() != null ? user.getRoonPort() : 9330)
                    .selectedZoneId(user.getRoonZoneId())
                    .selectedZoneName(user.getRoonZoneName())
                    .zones(Collections.emptyList())
                    .build();
        }

        try {
            RoonClient client = getOrCreateClient(user);
            return RoonStatusDto.builder()
                    .connected(client.isConnected())
                    .paired(client.isPaired())
                    .coreId(client.getCoreId())
                    .coreName(client.getCoreName())
                    .host(user.getRoonHost())
                    .port(user.getRoonPort() != null ? user.getRoonPort() : 9330)
                    .selectedZoneId(user.getRoonZoneId())
                    .selectedZoneName(user.getRoonZoneName())
                    .zones(client.getZones())
                    .build();
        } catch (Exception e) {
            log.warn("Could not retrieve Roon status for user {}: {}", username, e.getMessage());
            return RoonStatusDto.builder()
                    .connected(false)
                    .paired(user.getRoonToken() != null && !user.getRoonToken().isBlank())
                    .host(user.getRoonHost())
                    .port(user.getRoonPort() != null ? user.getRoonPort() : 9330)
                    .selectedZoneId(user.getRoonZoneId())
                    .selectedZoneName(user.getRoonZoneName())
                    .zones(Collections.emptyList())
                    .build();
        }
    }

    public List<RoonZoneDto> getZones(String username) {
        AppUser user = getUserByUsername(username);
        if (user.getRoonHost() == null || user.getRoonHost().isBlank()) {
            return Collections.emptyList();
        }

        try {
            RoonClient client = getOrCreateClient(user);
            return client.getZones();
        } catch (Exception e) {
            log.warn("Could not retrieve Roon zones for user {}: {}", username, e.getMessage());
            return Collections.emptyList();
        }
    }

    public RoonStatusDto updateSettings(String username, RoonSettingsDto settings) {
        AppUser user = getUserByUsername(username);

        // Disconnect existing session
        RoonClient existing = clientSessions.remove(user.getId());
        if (existing != null) {
            try {
                existing.close();
            } catch (Exception e) {
                // ignore
            }
        }

        String host = (settings.getRoonHost() != null && !settings.getRoonHost().isBlank())
                ? settings.getRoonHost().trim() : null;
        Integer port = settings.getRoonPort() != null ? settings.getRoonPort() : 9330;

        user.setRoonHost(host);
        user.setRoonPort(port);
        user.setRoonZoneId(settings.getRoonZoneId());
        user.setRoonZoneName(settings.getRoonZoneName());

        if (host == null) {
            user.setRoonToken(null);
        }

        appUserRepository.save(user);

        if (host != null && !host.isBlank()) {
            try {
                RoonClient client = getOrCreateClient(user);
                return RoonStatusDto.builder()
                        .connected(client.isConnected())
                        .paired(client.isPaired())
                        .coreId(client.getCoreId())
                        .coreName(client.getCoreName())
                        .host(user.getRoonHost())
                        .port(user.getRoonPort() != null ? user.getRoonPort() : 9330)
                        .selectedZoneId(user.getRoonZoneId())
                        .selectedZoneName(user.getRoonZoneName())
                        .zones(client.getZones())
                        .build();
            } catch (Exception e) {
                log.warn("Failed to connect after updating Roon settings for {}: {}", username, e.getMessage());
            }
        }

        return RoonStatusDto.builder()
                .connected(false)
                .paired(user.getRoonToken() != null && !user.getRoonToken().isBlank())
                .host(user.getRoonHost())
                .port(user.getRoonPort() != null ? user.getRoonPort() : 9330)
                .selectedZoneId(user.getRoonZoneId())
                .selectedZoneName(user.getRoonZoneName())
                .zones(Collections.emptyList())
                .build();
    }

    public boolean playAlbum(String username, RoonPlayRequestDto request) {
        AppUser user = getUserByUsername(username);

        if (user.getRoonHost() == null || user.getRoonHost().isBlank()) {
            throw new RoonApiException("Roon Core is not configured. Please configure host in Settings.");
        }

        RoonClient client = getOrCreateClient(user);
        if (!client.isConnected()) {
            throw new RoonApiException("Roon Core is not connected at " + user.getRoonHost() + ":" + user.getRoonPort());
        }

        String targetZoneId = request.getZoneId();
        if (targetZoneId == null || targetZoneId.isBlank()) {
            targetZoneId = user.getRoonZoneId();
        }

        if (targetZoneId == null || targetZoneId.isBlank()) {
            List<RoonZoneDto> zones = client.getZones();
            if (!zones.isEmpty()) {
                targetZoneId = zones.get(0).getZoneId();
            } else {
                throw new RoonApiException("No Roon playback zone selected or found.");
            }
        }

        return client.playAlbum(targetZoneId, request.getArtist(), request.getTitle());
    }

    private synchronized RoonClient getOrCreateClient(AppUser user) {
        RoonClient client = clientSessions.get(user.getId());
        if (client != null && client.isConnected()) {
            return client;
        }

        if (client != null) {
            try {
                client.close();
            } catch (Exception e) {
                // ignore
            }
        }

        int port = user.getRoonPort() != null ? user.getRoonPort() : 9100;
        RoonClient newClient = roonClientFactory.create(user.getRoonHost(), port, user.getRoonToken());
        newClient.setTokenUpdateListener(newToken -> {
            user.setRoonToken(newToken);
            appUserRepository.save(user);
        });

        newClient.connect(3);
        clientSessions.put(user.getId(), newClient);
        return newClient;
    }

    private AppUser getUserByUsername(String username) {
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    @PreDestroy
    public void cleanup() {
        for (RoonClient client : clientSessions.values()) {
            try {
                client.close();
            } catch (Exception e) {
                // ignore
            }
        }
        clientSessions.clear();
    }
}
