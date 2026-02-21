package com.pbl3.timtro.common.config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CloudinaryConfig {
    @Bean
    public Cloudinary cloudinary() {
        return new Cloudinary(ObjectUtils.asMap(
                "cloud_name", "dqzyw9u69",
                "api_key", "918696448766123",
                "api_secret", "WdkJ9EzbGj71cyJqmMg8PvecRoY"
        ));
    }
}
