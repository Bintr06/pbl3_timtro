package com.pbl3.timtro.registration.dto.request;

import lombok.Data;

@Data
public class RegistrationRequest {
    private String fullName;
    private String idCardNumber;
    private String phoneNumber;
    private String address;
}