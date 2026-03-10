package com.pbl3.timtro.common.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(request -> {
                    var corsConfiguration = new org.springframework.web.cors.CorsConfiguration();
                    // Thêm các port phổ biến của Frontend
                    corsConfiguration.setAllowedOrigins(java.util.List.of("http://localhost:3000", "http://localhost:5173"));
                    corsConfiguration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")); // Thêm PATCH cho duyệt đơn
                    corsConfiguration.setAllowedHeaders(java.util.List.of("*"));
                    corsConfiguration.setAllowCredentials(true);
                    return corsConfiguration;
                }))
                .authorizeHttpRequests(auth -> auth
                        // 1. Công khai hoàn toàn
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/rooms/**").permitAll() // Cho phép xem danh sách và chi tiết phòng
                        .requestMatchers("/api/ratings/{roomId}").permitAll() // Cho phép xem đánh giá mà không cần login
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

                        // 2. Quyền Admin
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // 3. Quyền Owner (Đăng bài, sửa bài)
                        .requestMatchers(HttpMethod.POST, "/api/rooms/**").hasRole("OWNER")
                        .requestMatchers(HttpMethod.PUT, "/api/rooms/**").hasRole("OWNER")
                        .requestMatchers(HttpMethod.DELETE, "/api/rooms/**").hasRole("OWNER")

                        // 4. Quyền User đã đăng nhập (Chat, Favorite, Rating, Register Owner)
                        .requestMatchers("/api/chat/**").authenticated()
                        .requestMatchers("/api/favorite/**").authenticated()
                        .requestMatchers("/api/ratings/**").authenticated()
                        .requestMatchers("/api/registrations/**").authenticated()
                        .requestMatchers("/api/users/**").authenticated()

                        // 5. Tất cả các request khác
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}