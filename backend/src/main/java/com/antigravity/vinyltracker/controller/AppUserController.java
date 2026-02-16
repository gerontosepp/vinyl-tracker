package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class AppUserController {

    private final AppUserRepository userRepository;

    public AppUserController(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<AppUser> getAllUsers() {
        return userRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<AppUser> createUser(@RequestBody AppUser user) {
        return userRepository.findByUsername(user.getUsername())
                .map(existingUser -> {
                    existingUser.setDiscogsToken(user.getDiscogsToken());
                    existingUser.setDiscogsUsername(user.getDiscogsUsername());
                    return ResponseEntity.ok(userRepository.save(existingUser));
                })
                .orElseGet(() -> ResponseEntity.ok(userRepository.save(user)));
    }

    @GetMapping("/{username}")
    public ResponseEntity<AppUser> getUser(@PathVariable String username) {
        return userRepository.findByUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
