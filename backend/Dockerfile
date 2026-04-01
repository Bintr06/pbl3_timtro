# Use official Maven image to build
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY backend/pom.xml .
RUN cd / && mvn -f /app/pom.xml dependency:resolve

# Copy source code
COPY backend/ .

# Build application
RUN mvn clean package -DskipTests

# Use official Java runtime as base image
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port (Render injects PORT env var)
EXPOSE 8080

# Set Spring profile to production
ENV SPRING_PROFILES_ACTIVE=prod

# Start application
ENTRYPOINT ["java", "-jar", "app.jar"]
