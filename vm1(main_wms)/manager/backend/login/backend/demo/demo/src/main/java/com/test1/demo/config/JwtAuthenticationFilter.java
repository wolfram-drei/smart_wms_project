package com.test1.demo.config;

import com.test1.demo.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String token = extractToken(request);

        if (token != null && jwtUtil.isValidToken(token)) {
            Claims claims = jwtUtil.getClaims(token);
            String email = claims.getSubject();
            String role = (String) claims.get("role");

            log.info("JWT 인증 성공 - email: {}, role: {}", email, role);

            // 이미 인증된 상태가 아니라면 SecurityContext에 설정
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                setAuthentication(email, role);
            }
        } else if (token != null) {
            log.warn("JWT 토큰이 유효하지 않음: {}", token);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Access token is invalid or expired\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /* 요청에서 JWT 토큰을 추출 (Authorization 헤더 → 쿠키 순) */
    private String extractToken(HttpServletRequest request) {
        // 1. Authorization 헤더 우선 확인
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // 2. 쿠키에서 accessToken 확인
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }

     /* 인증 객체를 생성하고 SecurityContext에 등록 */
    private void setAuthentication(String email, String role) {
        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);
        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(email, null, List.of(authority));

        SecurityContextHolder.getContext().setAuthentication(authToken);
    }
}
