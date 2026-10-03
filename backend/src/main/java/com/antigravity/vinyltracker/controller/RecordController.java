package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.dto.RecordDetailDto;
import com.antigravity.vinyltracker.service.RecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;

    @GetMapping("/{id}")
    public ResponseEntity<RecordDetailDto> getRecordDetails(@PathVariable Long id, Principal principal) {
        RecordDetailDto details = recordService.getRecordDetails(id, principal.getName());
        return ResponseEntity.ok(details);
    }
}
