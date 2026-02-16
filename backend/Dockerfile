FROM maven:3.9-eclipse-temurin-23 AS build
# Note: Maven image for 25 might not be officially tagged '3.9-eclipse-temurin-25' yet in some mirrors, 
# but 23 is definitely there. However, we want 25.
# Let's try explicit 25 if available, otherwise we might need a custom install.
# Given the date is Feb 2026, 25 should be available.
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:25-jdk-alpine
VOLUME /tmp
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
