package com.pbl3.timtro.common.exception;

import com.pbl3.timtro.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // Xử lý các lỗi logic nghiệp vụ mà bạn chủ động throw (ví dụ: "Username đã tồn tại")
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Object>> handleRuntimeException(RuntimeException e) {
        return ResponseEntity.badRequest().body(
                ApiResponse.builder()
                        .status(400)
                        .message(e.getMessage())
                        .build()
        );
    }

    // Xử lý lỗi validation (ví dụ: @NotBlank, @Size trên DTO)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage()));

        return ResponseEntity.badRequest().body(
                ApiResponse.<Map<String, String>>builder()
                        .status(400)
                        .message("Dữ liệu đầu vào không hợp lệ")
                        .data(errors)
                        .build()
        );
    }

    // Xử lý các lỗi hệ thống không mong muốn
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGeneralException(Exception e) {
        return ResponseEntity.status(500).body(
                ApiResponse.builder()
                        .status(500)
                        .message("Lỗi hệ thống: " + e.getMessage())
                        .build()
        );
    }
}
