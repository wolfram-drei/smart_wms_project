package com.test1.demo.dto;

import lombok.Data;

@Data
public class SignupRequest {
    private String email;
    private String username;
    private String password;
    private String phoneNumber;
    private String address;
    private String details;
}
