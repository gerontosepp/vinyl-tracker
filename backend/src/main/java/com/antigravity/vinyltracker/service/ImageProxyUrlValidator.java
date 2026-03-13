package com.antigravity.vinyltracker.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class ImageProxyUrlValidator {

    private final List<String> allowedHosts;

    public ImageProxyUrlValidator(
            @Value("${image-proxy.allowed-hosts:i.discogs.com,s.discogs.com,api.discogs.com}") String allowedHostsCsv
    ) {
        this.allowedHosts = Arrays.stream(allowedHostsCsv.split(","))
                .map(String::trim)
                .map(host -> host.toLowerCase(Locale.ROOT))
                .filter(host -> !host.isEmpty())
                .toList();
    }

    public boolean isAllowed(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank() || allowedHosts.isEmpty()) {
            return false;
        }

        final URI uri;
        try {
            uri = URI.create(rawUrl);
        } catch (IllegalArgumentException ex) {
            return false;
        }

        if (!uri.isAbsolute() || uri.getHost() == null) {
            return false;
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            return false;
        }

        if (uri.getUserInfo() != null) {
            return false;
        }

        if (uri.getPort() != -1 && uri.getPort() != 443) {
            return false;
        }

        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (!isHostAllowed(host) || "localhost".equals(host)) {
            return false;
        }

        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            if (addresses.length == 0) {
                return false;
            }
            for (InetAddress address : addresses) {
                if (!isPublicAddress(address)) {
                    return false;
                }
            }
        } catch (Exception ex) {
            return false;
        }

        return true;
    }

    private boolean isHostAllowed(String host) {
        for (String allowedHost : allowedHosts) {
            if (host.equals(allowedHost) || host.endsWith("." + allowedHost)) {
                return true;
            }
        }
        return false;
    }

    private boolean isPublicAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return false;
        }

        if (address instanceof Inet6Address inet6Address) {
            byte firstByte = inet6Address.getAddress()[0];
            int firstByteUnsigned = firstByte & 0xFF;
            if ((firstByteUnsigned & 0xFE) == 0xFC) {
                return false;
            }
        }

        return true;
    }
}