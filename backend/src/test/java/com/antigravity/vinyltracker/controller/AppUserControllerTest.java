package com.antigravity.vinyltracker.controller;

import com.antigravity.vinyltracker.model.AppUser;
import com.antigravity.vinyltracker.repository.AppUserRepository;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AppUserControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private AppUserController userController;

    private AppUser user1;
    private AppUser user2;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(userController).build();

        user1 = new AppUser();
        user1.setId(1L);
        user1.setUsername("user1");
        user1.setDiscogsUsername("discogs1");

        user2 = new AppUser();
        user2.setId(2L);
        user2.setUsername("user2");
        user2.setDiscogsUsername("discogs2");
    }

    @Test
    void getAllUsers_ShouldReturnListOfUsers() throws Exception {
        given(userRepository.findAll()).willReturn(List.of(user1, user2));

        mockMvc.perform(get("/api/users")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].username", is("user1")))
                .andExpect(jsonPath("$[1].username", is("user2")));
    }

    @Test
    void getUser_ShouldReturnUser_WhenUserExists() throws Exception {
        given(userRepository.findByUsername("user1")).willReturn(Optional.of(user1));

        mockMvc.perform(get("/api/users/user1")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username", is("user1")))
                .andExpect(jsonPath("$.discogsUsername", is("discogs1")));
    }

    @Test
    void getUser_ShouldReturnNotFound_WhenUserDoesNotExist() throws Exception {
        given(userRepository.findByUsername("unknown")).willReturn(Optional.empty());

        mockMvc.perform(get("/api/users/unknown")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void createUser_ShouldReturnSavedUser() throws Exception {
        AppUser newUser = new AppUser();
        newUser.setUsername("newUser");
        newUser.setDiscogsUsername("newDiscogs");

        given(userRepository.save(any(AppUser.class))).willAnswer(invocation -> {
            AppUser savedUser = invocation.getArgument(0);
            savedUser.setId(3L);
            return savedUser;
        });

        ObjectMapper objectMapper = new ObjectMapper();
        String userJson = objectMapper.writeValueAsString(newUser);

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(userJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(3)))
                .andExpect(jsonPath("$.username", is("newUser")));
    }
}
