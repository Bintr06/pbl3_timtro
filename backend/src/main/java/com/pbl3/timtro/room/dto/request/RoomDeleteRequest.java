package com.pbl3.timtro.room.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomDeleteRequest {
    private String reason;
    private Boolean notifyOwner;
}