package com.antigravity.vinyltracker.service.roon;

import org.springframework.stereotype.Component;

@Component
public class DefaultRoonClientFactory implements RoonClientFactory {

    @Override
    public RoonClient create(String host, int port, String token) {
        return new DefaultRoonClient(host, port, token);
    }
}
