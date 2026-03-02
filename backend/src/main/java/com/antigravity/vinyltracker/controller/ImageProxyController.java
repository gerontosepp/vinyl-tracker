package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.service.ImageProxyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/proxy")
public class ImageProxyController {

    private final ImageProxyService imageProxyService;

    public ImageProxyController(ImageProxyService imageProxyService) {
        this.imageProxyService = imageProxyService;
    }

    @GetMapping("/image")
    public ResponseEntity<byte[]> proxyImage(@RequestParam("url") String url) {
        if (url == null || !url.startsWith("http")) {
            return ResponseEntity.badRequest().build();
        }

        return imageProxyService.proxyImage(url)
                .orElse(ResponseEntity.status(HttpStatus.BAD_GATEWAY).build());
    }
}
