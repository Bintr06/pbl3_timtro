package com.pbl3.timtro.payment.repository;
import com.pbl3.timtro.payment.entity.TurnPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TurnPackageRepository extends JpaRepository<TurnPackage, Long> {
    List<TurnPackage> findByActiveTrueOrderByTurnsAsc();
}