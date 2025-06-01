package com.test1.demo.controller;

import com.test1.demo.service.SmsService;
import com.test1.demo.service.SmsVerificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/sms")
public class SmsController {

    private final SmsService smsService;
    private final SmsVerificationService verificationService;

    public SmsController(SmsService smsService, SmsVerificationService verificationService) {
        this.smsService = smsService;
        this.verificationService = verificationService;
    }

    // 인증번호 발송
    @PostMapping("/send")
    public ResponseEntity<?> sendVerificationCode(@RequestBody Map<String, String> request) {
        String phone = request.get("phoneNumber");
        if (phone == null || phone.isEmpty()) {
            return ResponseEntity.badRequest().body("전화번호가 없습니다.");
        }

        // 인증번호 생성
        String code = String.valueOf(new Random().nextInt(900000) + 100000); // 100000 ~ 999999
        String message = "[WMS] testcode [ " + code + " ] 입니다.";

        // 문자 전송 + 인증번호 저장
        smsService.sendSms(phone, message);
        verificationService.saveVerificationCode(phone, code);

        return ResponseEntity.ok("인증번호 전송 완료");
    }

    // 인증번호 확인
    @PostMapping("/verify")
    public ResponseEntity<?> verifyCode(@RequestBody Map<String, String> request) {
        String phone = request.get("phoneNumber");
        String code = request.get("code");

        if (verificationService.verifyCode(phone, code)) {
            verificationService.clearCode(phone);
            return ResponseEntity.ok("인증 성공");
        } else {
            return ResponseEntity.status(400).body("인증 실패: 코드가 일치하지 않거나 만료됨");
        }
    }
}
