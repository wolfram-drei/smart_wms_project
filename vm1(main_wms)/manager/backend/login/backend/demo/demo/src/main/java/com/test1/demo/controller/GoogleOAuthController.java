package com.test1.demo.controller;

import com.test1.demo.entity.User;
import com.test1.demo.repository.UserRepository;
import com.test1.demo.service.RedisService;
import com.test1.demo.util.JwtUtil;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/oauth")
public class GoogleOAuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RedisService redisService;

    @PostMapping("/google")
    public ResponseEntity<?> handleGoogleLogin(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String email = request.get("email");
        String username = request.get("username");
    
        Optional<User> optionalUser = userRepository.findByEmail(email);
        User user;
    
        if (optionalUser.isPresent()) {
            user = optionalUser.get();
        } else {
            user = User.builder()
                    .email(email)
                    .username(username)
                    .password("")
                    .role("user")
                    .build();
            userRepository.save(user);
        }
    
        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());
    
        // 🔽 Redis에도 저장 추가
        redisService.save(user.getEmail(), refreshToken, 60 * 60 * 24 * 7); // 7일 TTL
    
        jwtUtil.addTokensToCookie(response, accessToken, refreshToken); // access + refresh 모두 쿠키 저장
    
        return ResponseEntity.ok(Map.of(
                "token", accessToken,
                "role", user.getRole()
        ));
    }
    
}
