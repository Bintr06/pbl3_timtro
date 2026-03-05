package com.pbl3.timtro.user.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserUpdateRequest {
    private String displayName;
    private String phone;
    private String bio;
    private String email;
}
