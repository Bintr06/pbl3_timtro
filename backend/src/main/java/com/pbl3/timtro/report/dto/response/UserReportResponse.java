package com.pbl3.timtro.report.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserReportResponse {
    private Long id;
    private Long reporterId;
    private String reporterName;
    private String reporterUsername;
    private Long reportedUserId;
    private String reportedUserName;
    private String reportedUserUsername;
    private String description;
    private String evidenceImageUrl;
    private String status;
    private LocalDateTime createdAt;
}
