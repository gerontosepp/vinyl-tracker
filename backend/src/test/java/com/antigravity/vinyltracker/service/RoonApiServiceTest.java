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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoonApiServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private RoonClientFactory roonClientFactory;

    @Mock
    private RoonClient roonClient;

    private RoonApiService roonApiService;

    private AppUser testUser;

    @BeforeEach
    void setUp() {
        roonApiService = new RoonApiService(appUserRepository, roonClientFactory);

        testUser = new AppUser("testuser", "hashedpass");
        testUser.setId(1L);
    }

    @Test
    void getStatus_WhenNoHostConfigured_ReturnsDisconnected() {
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));

        RoonStatusDto status = roonApiService.getStatus("testuser");

        assertThat(status.isConnected()).isFalse();
        assertThat(status.isPaired()).isFalse();
        assertThat(status.getZones()).isEmpty();
        verifyNoInteractions(roonClientFactory);
    }

    @Test
    void getStatus_WhenHostConfiguredAndConnected_ReturnsStatusWithZones() {
        testUser.setRoonHost("192.168.1.100");
        testUser.setRoonPort(9100);
        testUser.setRoonToken("secret-token");

        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create("192.168.1.100", 9100, "secret-token")).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.isPaired()).thenReturn(true);
        when(roonClient.getCoreId()).thenReturn("core-1");
        when(roonClient.getCoreName()).thenReturn("Roon Core Living");
        when(roonClient.getZones()).thenReturn(List.of(new RoonZoneDto("z1", "Living Room", "playing")));

        RoonStatusDto status = roonApiService.getStatus("testuser");

        assertThat(status.isConnected()).isTrue();
        assertThat(status.isPaired()).isTrue();
        assertThat(status.getCoreId()).isEqualTo("core-1");
        assertThat(status.getCoreName()).isEqualTo("Roon Core Living");
        assertThat(status.getZones()).hasSize(1);
        verify(roonClient).connect(3);
    }

    @Test
    void getStatus_WhenConnectionFails_ReturnsDisconnectedGracefully() {
        testUser.setRoonHost("192.168.1.100");
        testUser.setRoonToken("some-token");

        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), eq("some-token"))).thenReturn(roonClient);
        doThrow(new RuntimeException("Connection timed out")).when(roonClient).connect(anyLong());

        RoonStatusDto status = roonApiService.getStatus("testuser");

        assertThat(status.isConnected()).isFalse();
        assertThat(status.isPaired()).isTrue();
        assertThat(status.getZones()).isEmpty();
    }

    @Test
    void getZones_WhenNoHostConfigured_ReturnsEmptyList() {
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));

        List<RoonZoneDto> zones = roonApiService.getZones("testuser");

        assertThat(zones).isEmpty();
    }

    @Test
    void getZones_WhenHostConfigured_ReturnsClientZones() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.getZones()).thenReturn(List.of(new RoonZoneDto("z1", "Office", "stopped")));

        List<RoonZoneDto> zones = roonApiService.getZones("testuser");

        assertThat(zones).hasSize(1);
        assertThat(zones.get(0).getName()).isEqualTo("Office");
    }

    @Test
    void updateSettings_SavesUserAndConnectsClient() {
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create("192.168.1.200", 9100, null)).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.isPaired()).thenReturn(true);

        RoonSettingsDto settings = RoonSettingsDto.builder()
                .roonHost("192.168.1.200")
                .roonPort(9100)
                .roonZoneId("z-hifi")
                .roonZoneName("Hi-Fi System")
                .build();

        RoonStatusDto status = roonApiService.updateSettings("testuser", settings);

        assertThat(testUser.getRoonHost()).isEqualTo("192.168.1.200");
        assertThat(testUser.getRoonPort()).isEqualTo(9100);
        assertThat(testUser.getRoonZoneId()).isEqualTo("z-hifi");
        assertThat(testUser.getRoonZoneName()).isEqualTo("Hi-Fi System");
        verify(appUserRepository).save(testUser);
        assertThat(status.isConnected()).isTrue();
    }

    @Test
    void updateSettings_WhenHostCleared_ClearsTokenAndReturnsDisconnected() {
        testUser.setRoonHost("192.168.1.100");
        testUser.setRoonToken("old-token");

        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));

        RoonSettingsDto settings = RoonSettingsDto.builder()
                .roonHost("")
                .build();

        RoonStatusDto status = roonApiService.updateSettings("testuser", settings);

        assertThat(testUser.getRoonHost()).isNull();
        assertThat(testUser.getRoonToken()).isNull();
        verify(appUserRepository).save(testUser);
        assertThat(status.isConnected()).isFalse();
    }

    @Test
    void playAlbum_WhenNoHost_ThrowsRoonApiException() {
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Daft Punk")
                .title("Discovery")
                .build();

        assertThatThrownBy(() -> roonApiService.playAlbum("testuser", request))
                .isInstanceOf(RoonApiException.class)
                .hasMessageContaining("Roon Core is not configured");
    }

    @Test
    void playAlbum_WhenClientDisconnected_ThrowsRoonApiException() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(false);

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Daft Punk")
                .title("Discovery")
                .build();

        assertThatThrownBy(() -> roonApiService.playAlbum("testuser", request))
                .isInstanceOf(RoonApiException.class)
                .hasMessageContaining("Roon Core is not connected");
    }

    @Test
    void playAlbum_UsesSpecifiedZoneId() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.playAlbum("explicit-zone", "Miles Davis", "Kind of Blue")).thenReturn(true);

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Miles Davis")
                .title("Kind of Blue")
                .zoneId("explicit-zone")
                .build();

        boolean result = roonApiService.playAlbum("testuser", request);

        assertThat(result).isTrue();
        verify(roonClient).playAlbum("explicit-zone", "Miles Davis", "Kind of Blue");
    }

    @Test
    void playAlbum_FallsBackToUserConfiguredZoneId() {
        testUser.setRoonHost("192.168.1.100");
        testUser.setRoonZoneId("user-default-zone");

        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.playAlbum("user-default-zone", "Miles Davis", "Kind of Blue")).thenReturn(true);

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Miles Davis")
                .title("Kind of Blue")
                .build();

        boolean result = roonApiService.playAlbum("testuser", request);

        assertThat(result).isTrue();
        verify(roonClient).playAlbum("user-default-zone", "Miles Davis", "Kind of Blue");
    }

    @Test
    void playAlbum_FallsBackToFirstAvailableZone() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.getZones()).thenReturn(List.of(new RoonZoneDto("auto-first-zone", "Living Room", "stopped")));
        when(roonClient.playAlbum("auto-first-zone", "Miles Davis", "Kind of Blue")).thenReturn(true);

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Miles Davis")
                .title("Kind of Blue")
                .build();

        boolean result = roonApiService.playAlbum("testuser", request);

        assertThat(result).isTrue();
        verify(roonClient).playAlbum("auto-first-zone", "Miles Davis", "Kind of Blue");
    }

    @Test
    void playAlbum_WhenNoZoneAvailable_ThrowsRoonApiException() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);
        when(roonClient.getZones()).thenReturn(Collections.emptyList());

        RoonPlayRequestDto request = RoonPlayRequestDto.builder()
                .artist("Miles Davis")
                .title("Kind of Blue")
                .build();

        assertThatThrownBy(() -> roonApiService.playAlbum("testuser", request))
                .isInstanceOf(RoonApiException.class)
                .hasMessageContaining("No Roon playback zone selected or found");
    }

    @Test
    void cleanup_ClosesAllSessions() {
        testUser.setRoonHost("192.168.1.100");
        when(appUserRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(roonClientFactory.create(eq("192.168.1.100"), anyInt(), any())).thenReturn(roonClient);
        when(roonClient.isConnected()).thenReturn(true);

        roonApiService.getStatus("testuser");

        roonApiService.cleanup();

        verify(roonClient).close();
    }
}
