package com.pbl3.timtro.payment.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "turn_packages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TurnPackage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer turns;

    @Column(nullable = false)
    private Double price;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private boolean active = true;
}
