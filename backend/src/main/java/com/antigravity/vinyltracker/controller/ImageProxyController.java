package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.service.ImageProxyService;
import com.antigravity.vinyltracker.service.ImageProxyUrlValidator;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/proxy")
@lombok.RequiredArgsConstructor
public class ImageProxyController {

    private final ImageProxyService imageProxyService;
    private final ImageProxyUrlValidator imageProxyUrlValidator;

    @GetMapping("/image")
    public ResponseEntity<byte[]> proxyImage(@RequestParam("url") String url) {
        if (!imageProxyUrlValidator.isAllowed(url)) {
            return ResponseEntity.badRequest().build();
        }

        return imageProxyService.proxyImage(url)
                .orElse(ResponseEntity.status(HttpStatus.BAD_GATEWAY).build());
    }
}
