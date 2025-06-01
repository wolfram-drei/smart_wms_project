package com.test1.demo.controller;

import com.test1.demo.entity.User;
import com.test1.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    // 관리자: 모든 사용자 조회
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<User> users = userRepository.findAll();

        if (users.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("사용자가 없습니다.");
        }

        List<Map<String, Object>> userList = users.stream()
                .map(user -> {
                    Map<String, Object> userMap = new java.util.HashMap<>();
                    userMap.put("email", user.getEmail());
                    userMap.put("username", user.getUsername());
                    userMap.put("phoneNumber", user.getPhoneNumber());
                    userMap.put("address", user.getAddress());
                    userMap.put("details", user.getDetails());
                    userMap.put("role", user.getRole());
                    userMap.put("createdAt", user.getCreatedAt());
                    userMap.put("status", "active");
                    return userMap;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(userList);
    }

    // admin : change UserRole
    @PutMapping("/users/{email}")
    public ResponseEntity<?> changeUserRole(@PathVariable String email, @RequestBody Map<String, String> request) {
        Optional<User> optionalUser = userRepository.findByEmail(email);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(404).body("사용자가 존재하지 않습니다.");
        }

        User user = optionalUser.get();
        String newRole = request.get("role");

        user.setRole(newRole);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("email", user.getEmail(), "role", user.getRole()));
    }
    // delete UserInfo
    @DeleteMapping("/users/{email}")
    public ResponseEntity<?> deleteUser(@PathVariable String email) {
        Optional<User> optionalUser = userRepository.findByEmail(email);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("사용자를 찾을 수 없습니다.");
        }

        userRepository.delete(optionalUser.get());
        return ResponseEntity.ok("사용자가 삭제되었습니다.");
    }


}
