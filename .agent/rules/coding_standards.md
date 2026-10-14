---
trigger: always_on
---

1. **Backend Tech Stack & Architecture**: 
   - Use Java 25 and Spring Boot 4.x.
   - Use Lombok for boilerplate code (e.g., `@Data`, `@RequiredArgsConstructor`, `@Builder`).
   - Enforce a strict layered architecture: Controllers must only handle HTTP routing and delegate logic to Services. Services contain business logic. Repositories handle data access.
   - DTOs & Serialization: Use expressive DTOs with snake_case JSON properties via `@JsonProperty("field_name")`.
   - Resilience & Caching: Guard external APIs (Discogs, Roon) with Resilience4j rate limiting (`@RateLimiter(name = "discogs")`), retries, and Caffeine caching.
2. **Frontend Tech Stack & Architecture**: 
   - Use Angular 19 with TypeScript and standalone components.
   - Use Angular Signals for reactive state management.
   - Use Tailwind CSS for styling via utility classes. Avoid custom CSS unless absolutely necessary (e.g., complex keyframe animations).
   - **Internationalization (i18n)**: All user-facing UI text must be localized via `LanguageService` and `TranslatePipe`. Maintain both German (`de`) and English (`en`) dictionaries in `language.service.ts`. Never hardcode static display strings in templates.
3. **Date & Time Convention (CRITICAL)**:
   - Use ISO 8601 format for all date and time representations.
   - Database and Backend operations MUST ALWAYS use UTC (`LocalDateTime` in Java, formatted with `JacksonConfig.UTC_FORMATTER`).
   - Frontend must receive UTC from the API but MUST display local time to the user (`Date` object in JS/TS or `LocalizedDatePipe`).
4. **API Communication & Security**: 
   - All backend errors must return structured JSON problem details (`ProblemDetail`).
   - The frontend must handle API errors gracefully, typically showing user-friendly toast notifications (`ToastService`) instead of failing silently.
   - When introducing new HTTP methods (e.g., `PATCH`), ensure they are allowed in `AppConfig.java` CORS configuration (`allowedMethods`).
