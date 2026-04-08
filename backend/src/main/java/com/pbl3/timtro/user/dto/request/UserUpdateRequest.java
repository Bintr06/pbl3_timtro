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
    private String address;
    private String nickname;
    private String facebook;
    private String instagram;
    private String linkedin;
}
