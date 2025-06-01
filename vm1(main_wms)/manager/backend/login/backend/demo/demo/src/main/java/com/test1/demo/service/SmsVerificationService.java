package com.test1.demo.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SmsVerificationService {

    private final Map<String, String> verificationCodes = new ConcurrentHashMap<>();

    public void saveVerificationCode(String phone, String code) {
        verificationCodes.put(phone, code);
    }

    public boolean verifyCode(String phone, String inputCode) {
        String savedCode = verificationCodes.get(phone);
        return savedCode != null && savedCode.equals(inputCode);
    }

    public void clearCode(String phone) {
        verificationCodes.remove(phone);
    }
}
