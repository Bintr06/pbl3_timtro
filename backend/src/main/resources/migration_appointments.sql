CREATE TABLE appointments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    tenant_id BIGINT NOT NULL,
    landlord_id BIGINT NOT NULL,
    appointment_time DATETIME(6) NOT NULL,
    note TEXT,
    status VARCHAR(16) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_appointments_room_id (room_id),
    INDEX idx_appointments_tenant_id (tenant_id),
    INDEX idx_appointments_landlord_id (landlord_id),
    CONSTRAINT fk_appointments_room_id FOREIGN KEY (room_id) REFERENCES rooms (id),
    CONSTRAINT fk_appointments_tenant_id FOREIGN KEY (tenant_id) REFERENCES users (id),
    CONSTRAINT fk_appointments_landlord_id FOREIGN KEY (landlord_id) REFERENCES users (id)
);

