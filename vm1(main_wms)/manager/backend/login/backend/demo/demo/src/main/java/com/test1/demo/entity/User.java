package com.test1.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;


@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 100)
    private String email;
    @Column(nullable = false, length = 50)
    private String username;
    @Column(nullable = false, length = 255)
    private String password;
    @Column(length = 20)
    private String phoneNumber;
    @Column(length = 255)
    private String address;
    @Column(length = 255)
    private String details;
    @Column(nullable = false)
    private String contactPerson;
    @Column(nullable = false)
    private String contactPhone;
    @Column(nullable = false, length = 20)
    private String role; // 예: "admin" 또는 "user"
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
