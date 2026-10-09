package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.RoonPlayRequestDto;
import com.antigravity.vinyltracker.model.dto.RoonSettingsDto;
import com.antigravity.vinyltracker.model.dto.RoonStatusDto;
import com.antigravity.vinyltracker.model.dto.RoonZoneDto;
import com.antigravity.vinyltracker.service.RoonApiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roon")
@RequiredArgsConstructor
public class RoonController {

    private final RoonApiService roonApiService;

    @GetMapping("/status")
    public ResponseEntity<RoonStatusDto> getStatus(Principal principal) {
        return ResponseEntity.ok(roonApiService.getStatus(principal.getName()));
    }

    @GetMapping("/zones")
    public ResponseEntity<List<RoonZoneDto>> getZones(Principal principal) {
        return ResponseEntity.ok(roonApiService.getZones(principal.getName()));
    }

    @PostMapping("/settings")
    public ResponseEntity<RoonStatusDto> updateSettings(Principal principal,
                                                        @Valid @RequestBody RoonSettingsDto settings) {
        return ResponseEntity.ok(roonApiService.updateSettings(principal.getName(), settings));
    }

    @PostMapping("/play")
    public ResponseEntity<Map<String, Object>> play(Principal principal,
                                                    @Valid @RequestBody RoonPlayRequestDto request) {
        boolean success = roonApiService.playAlbum(principal.getName(), request);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", "Playback command sent to Roon Core"
        ));
    }
}
