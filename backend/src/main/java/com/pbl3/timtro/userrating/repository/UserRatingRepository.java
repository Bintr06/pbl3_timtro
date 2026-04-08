package com.pbl3.timtro.userrating.repository;

import com.pbl3.timtro.userrating.entity.UserRating;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRatingRepository extends JpaRepository<UserRating, Long> {

    boolean existsByRaterIdAndRatedUserId(Long raterId, Long ratedUserId);

    @EntityGraph(attributePaths = {"rater", "ratedUser"})
    List<UserRating> findAllByRatedUserIdOrderByCreatedAtDesc(Long ratedUserId);

    @Query("SELECT CAST(AVG(ur.stars) AS java.lang.Double) FROM UserRating ur")
    Double getAverageRating();

    @Query("SELECT CAST(AVG(ur.stars) AS java.lang.Double) FROM UserRating ur WHERE ur.ratedUser.id = :userId")
    Double getAverageRatingForUser(@Param("userId") Long userId);

    @Query("SELECT ur.ratedUser.id, CAST(AVG(ur.stars) AS java.lang.Double) FROM UserRating ur GROUP BY ur.ratedUser.id")
    List<Object[]> getAverageRatingGroupedByRatedUserId();

    @Query("SELECT u.id, u.username, u.displayName, CAST(AVG(ur.stars) AS DOUBLE) as avgRating, COUNT(ur) as ratingCount " +
           "FROM UserRating ur " +
           "JOIN ur.ratedUser u " +
           "GROUP BY u.id, u.username, u.displayName " +
           "HAVING AVG(ur.stars) <= :maxStars " +
           "ORDER BY AVG(ur.stars) ASC, COUNT(ur) DESC")
    List<Object[]> findLowRatedUsers(@Param("maxStars") Integer maxStars);

    @EntityGraph(attributePaths = {"rater", "ratedUser"})
    @Query("SELECT ur FROM UserRating ur WHERE ur.rater.username = :username ORDER BY ur.createdAt DESC")
    List<UserRating> findByRaterUsername(@Param("username") String username);
}
