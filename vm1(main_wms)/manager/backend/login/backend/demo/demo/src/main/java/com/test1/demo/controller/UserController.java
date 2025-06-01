package com.test1.demo.controller;

import com.test1.demo.dto.LoginRequest;
import com.test1.demo.dto.SignupRequest;
import com.test1.demo.entity.User;
import com.test1.demo.repository.UserRepository;
import com.test1.demo.util.JwtUtil;
import com.test1.demo.service.RedisService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final RedisService redisService;

    // 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail());
        if (optionalUser.isEmpty()) {
            return unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = optionalUser.get();
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 1. 토큰 생성
        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());

        // 2. RefreshToken DB 저장
        redisService.save(user.getEmail(), refreshToken, 60 * 60 * 24 * 7);

        // 3. 쿠키 저장
        jwtUtil.addTokensToCookie(response, accessToken, refreshToken);

        // 4. 응답
        return ResponseEntity.ok(Map.of("email", user.getEmail(), "role", user.getRole()));
    }

    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequest request) {
        try {
            if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                return ResponseEntity.badRequest().body("이미 존재하는 이메일입니다.");
            }
    
            User newUser = User.builder()
                    .email(request.getEmail())
                    .username(request.getUsername())
                    .password(passwordEncoder.encode(request.getPassword()))
                    .phoneNumber(request.getPhoneNumber())
                    .address(request.getAddress())
                    .details(request.getDetails())
                    .role("user")
                    .build();
    
            userRepository.save(newUser);
    
            String token = jwtUtil.generateAccessToken(newUser.getEmail(), "user");
    
            return ResponseEntity.ok(Map.of(
                    "token", token,
                    "email", newUser.getEmail(),
                    "role", newUser.getRole()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("회원가입 중 오류가 발생했습니다: " + e.getMessage());
        }
    }    

    // 로그아웃
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        String email = jwtUtil.extractEmail(getCookieValue(request, "refreshToken"));
        if (email == null) return unauthorized("로그인된 사용자가 없습니다.");

        Optional<User> optionalUser = userRepository.findByEmail(email);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("사용자를 찾을 수 없습니다.");
        }

        User user = optionalUser.get();
        String refreshToken = getCookieValue(request, "refreshToken");
        if (refreshToken != null) {
            redisService.delete(email);
        }


        // 쿠키 삭제
        ResponseCookie expiredCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.setHeader("Set-Cookie", expiredCookie.toString());

        return ResponseEntity.ok("로그아웃 완료");
    }

    // AccessToken 재발급 (POST 방식, 프론트 인터셉터용)
    @PostMapping("/reissue")
    public ResponseEntity<?> reissueAccessToken(HttpServletRequest request, HttpServletResponse response) {
        // 1. 쿠키에서 refreshToken 꺼냄
        String refreshToken = getCookieValue(request, "refreshToken");
        if (refreshToken == null || !jwtUtil.isValidToken(refreshToken)) {
            return unauthorized("리프레시 토큰이 유효하지 않습니다.");
        }
    
        // 2. 리프레시 토큰에서 이메일 추출
        String email;
        try {
            email = jwtUtil.extractEmail(refreshToken);
        } catch (Exception e) {
            return unauthorized("리프레시 토큰에서 이메일 추출 실패");
        }
    
        // 3. Redis에 저장된 토큰과 비교
        String redisRefreshToken = redisService.get(email);
        if (redisRefreshToken == null || !refreshToken.equals(redisRefreshToken)) {
            return unauthorized("리프레시 토큰이 일치하지 않음");
        }
    
        // 4. 사용자 조회
        Optional<User> optionalUser = userRepository.findByEmail(email);
        if (optionalUser.isEmpty()) {
            return unauthorized("사용자를 찾을 수 없습니다.");
        }
    
        // 5. 새 AccessToken 발급
        User user = optionalUser.get();
        String newAccessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole());
    
        // 6. 쿠키에 저장
        jwtUtil.addAccessTokenToCookie(response, newAccessToken);
    
        return ResponseEntity.ok("AccessToken 재발급 완료");
    }
    

    // 유틸 메서드들
    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        boolean exists = userRepository.existsByEmail(email);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    private String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
    }

    private String getCookieValue(HttpServletRequest request, String cookieName) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> cookieName.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private ResponseEntity<?> unauthorized(String message) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(message);
    }
}
