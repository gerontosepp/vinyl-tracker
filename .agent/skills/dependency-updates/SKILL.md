---
name: dependency-updates
description: >-
  Standardized procedure to check, update, and validate frontend and backend dependencies
  for Vinyl Tracker while maintaining compatibility, stability, and code coverage.
---

# Vinyl Tracker Dependency Updates Skill

This skill defines the routine for discovering, upgrading, and testing dependencies in the Vinyl Tracker repository.

## 1. Backend Dependency Upgrades

### Checking Available Updates
Run the Maven versions plugin from the `backend/` directory:
```bash
cd backend
mvn versions:display-dependency-updates
mvn versions:display-parent-updates
mvn versions:display-property-updates
cd ..
```

### Known Project Constraints & Compatibility Rules
1. **Lombok Alignment**:
   Always ensure the version in `<annotationProcessorPaths>` inside `maven-compiler-plugin` matches the version in `<dependencies>`:
   ```xml
   <!-- Both must use the same version, e.g. 1.18.46 -->
   <dependency>
       <groupId>org.projectlombok</groupId>
       <artifactId>lombok</artifactId>
       <version>1.18.46</version>
       <optional>true</optional>
   </dependency>
   ```
2. **Resilience4j Compatibility**:
   Keep `resilience4j-spring-boot3` at version `2.2.0`. Version `2.4.0+` has known runtime compatibility conflicts with the project's Spring Boot configuration.
3. **Java Version**:
   The project targets Java 25 (`<java.version>25</java.version>`). Verify that all upgraded libraries support Java 25 bytecode.
4. **Testcontainers**:
   Maintain Testcontainers 1.21.x compatibility (`testcontainers.version`).

### Backend Validation
After updating [`backend/pom.xml`](file:///home/opolm/develop/vinyl-tracker/backend/pom.xml):
```bash
cd backend
mvn clean test
# Full verification including integration tests and JaCoCo >80% coverage check:
mvn verify
cd ..
```

## 2. Frontend Dependency Upgrades

### Checking Available Updates
Check outdated npm packages in `frontend/`:
```bash
cd frontend
npm outdated
cd ..
```

### Known Frontend Constraints & Guidelines
1. **Angular Major Version**:
   The project is built on Angular 19 (`@angular/*` ^19.2.x, `@angular/cli` ^19.2.x). Do not bump to Angular 20+ without a planned framework migration.
2. **NPM 12 Remote Fetching**:
   When using npm 12+, remote tarball downloads may be restricted by default. Use `--allow-remote=all`:
   ```bash
   cd frontend
   npm update --legacy-peer-deps --allow-remote=all
   cd ..
   ```
3. **Security Audit & Transitive Vulnerabilities**:
   Run audit fix for non-breaking transitive vulnerability patches:
   ```bash
   cd frontend
   npm audit fix --allow-remote=all
   cd ..
   ```

### Frontend Validation
```bash
cd frontend
# Ensure application builds cleanly
npm run build
cd ..
```

## 3. Docker Integration Check

Always verify that Docker container images build cleanly after dependency upgrades:
```bash
docker compose build
```

## 4. Documentation & Commit

1. Record updated libraries in [`docs/Release-Info.md`](file:///home/opolm/develop/vinyl-tracker/docs/Release-Info.md).
2. Commit with Conventional Commits:
   ```bash
   git add backend/pom.xml frontend/package.json frontend/package-lock.json docs/Release-Info.md
   git commit -m "chore: update backend and frontend project dependencies"
   ```
