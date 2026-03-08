---
trigger: always_on
---

---
trigger: always_on
---

1. **Mandatory Testing**: Never modify business logic or UI behavior without adding or updating the corresponding tests.
2. **Testing Frameworks**: 
   - Backend: Use JUnit 5, Mockito, and Spring Boot Test `@SpringBootTest`.
   - Frontend: Use Vitest and React Testing Library (`@testing-library/react`).
3. **Coverage Goal**: Maintain a test coverage of **> 80%**. Do not write empty or hollow tests just to inflate coverage; assert actual business logic outcomes and UI state changes.
4. **Validation**: 
   - Always run the full test suite locally before considering a task complete.
   - ALL tests must pass. Do not leave skipped or commented-out failing tests.
5. **Linting & Types**: Before completing a task, ensure no new TypeScript or ESLint errors were introduced. Fix any type mismatches rather than using `any` or `@ts-ignore`.
