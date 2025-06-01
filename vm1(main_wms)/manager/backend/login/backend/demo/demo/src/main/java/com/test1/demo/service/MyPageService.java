package com.test1.demo.service;

import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import com.test1.demo.dto.MyPageResponse;
import com.test1.demo.repository.UserRepository; // 너의 위치에 따라 조정
import com.test1.demo.entity.User; // 유저 클래스 경로
import com.test1.demo.util.JwtUtil;
import java.util.Map;
import java.util.HashMap;

@Service
@RequiredArgsConstructor
public class MyPageService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;  // ✅ JwtUtil 주입받기

    public MyPageResponse getMyInfo(String token) {
        String email = jwtUtil.extractEmail(token.replace("Bearer ", "")); // ✅ static 호출 X
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        MyPageResponse result = new MyPageResponse();
        result.setEmail(user.getEmail());
        result.setUsername(user.getUsername());
        result.setPhoneNumber(user.getPhoneNumber());
        result.setAddress(user.getAddress());
        result.setDetails(user.getDetails());
        return result;
    }

    public void updateMyInfo(String token, Map<String, String> data) {
        String email = jwtUtil.extractEmail(token.replace("Bearer ", "")); // ✅ static 호출 X
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자 없음"));

        user.setUsername(data.get("username"));
        user.setPhoneNumber(data.get("phone_number"));
        user.setAddress(data.get("address"));
        user.setDetails(data.get("details"));
        userRepository.save(user);
    }
}