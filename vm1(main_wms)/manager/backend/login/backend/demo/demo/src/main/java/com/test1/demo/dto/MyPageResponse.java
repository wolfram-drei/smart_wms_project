package com.test1.demo.dto;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonProperty;

@Data
public class MyPageResponse {
    private String email;
    private String username;
    @JsonProperty("phone_number")
    private String phoneNumber;
    private String address;
    private String details;
}
