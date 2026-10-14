---
trigger: always_on
---

1. **Mandatory Testing**: Never modify business logic or UI behavior without adding or updating the corresponding tests.
2. **Testing Frameworks**: 
   - Backend: Use JUnit 5, Mockito, and Spring Boot Test (`@SpringBootTest`, Testcontainers).
   - Frontend: Use Karma and Jasmine for unit tests, and Playwright for end-to-end tests.
3. **Coverage Goal**: Maintain a test coverage of **> 80%** enforced via JaCoCo (Backend). Do not write empty or hollow tests just to inflate coverage; assert actual business logic outcomes and UI state changes.
4. **Validation (Mandatory Commands)**: 
   - Backend: Always run tests with the project JDK: `JAVA_HOME=/opt/homebrew/opt/openjdk@25 mvn test` (or `mvn verify`).
   - Frontend: Always run unit tests non-interactively: `cd frontend && npm test -- --watch=false && npm run build`.
   - ALL tests must pass. Do not leave skipped or commented-out failing tests.
5. **Linting & Types**: Before completing a task, ensure no new TypeScript compiler or build errors were introduced. Fix any type mismatches rather than using `any` or `@ts-ignore`.
