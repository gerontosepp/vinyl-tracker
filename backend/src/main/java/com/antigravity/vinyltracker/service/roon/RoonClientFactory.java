package com.antigravity.vinyltracker.service.roon;

public interface RoonClientFactory {
    RoonClient create(String host, int port, String token);
}
