package com.antigravity.vinyltracker.service.roon;

import com.antigravity.vinyltracker.model.dto.RoonZoneDto;

import java.util.List;
import java.util.function.Consumer;

public interface RoonClient extends AutoCloseable {
    void connect(long timeoutSeconds);
    boolean isConnected();
    boolean isPaired();
    String getCoreId();
    String getCoreName();
    List<RoonZoneDto> getZones();
    boolean playAlbum(String zoneId, String artist, String title);
    void setTokenUpdateListener(Consumer<String> listener);
    void close();
}
