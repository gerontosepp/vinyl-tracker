---
trigger: always_on
---

1. **Backend Tech Stack & Architecture**: 
   - Use Rust (2024 edition), Axum 0.8, Tokio 1.x, and SQLx 0.8.
   - Enforce a strict layered architecture: Handlers/Routes (`routes/`) handle HTTP routing/delegation. Services (`services/`) contain business logic. Models (`models/`) define DTOs, domain models, and SQL representations.
   - DTOs & Serialization: Use expressive DTOs with snake_case JSON serialization via Serde (`#[serde(rename_all = "snake_case")]` or `#[serde(rename = "...")]`).
   - Resilience & Caching: Guard external APIs (Discogs, Roon) with Governor rate limiting, Reqwest HTTP client with retries/timeouts, and Moka in-memory caching.
2. **Frontend Tech Stack & Architecture**: 
   - Use Angular 22 with TypeScript and standalone components.
   - Use Angular Signals for reactive state management.
   - Use Tailwind CSS for styling via utility classes. Avoid custom CSS unless absolutely necessary (e.g., complex keyframe animations).
   - **Internationalization (i18n)**: All user-facing UI text must be localized via `LanguageService` and `TranslatePipe`. Maintain both German (`de`) and English (`en`) dictionaries in `language.service.ts`. Never hardcode static display strings in templates.
3. **Date & Time Convention (CRITICAL)**:
   - Use ISO 8601 format for all date and time representations.
   - Database and Backend operations MUST ALWAYS use UTC (`chrono::DateTime<Utc>` or `NaiveDateTime` in UTC).
   - Frontend must receive UTC from the API but MUST display local time to the user (`Date` object in JS/TS or `LocalizedDatePipe`).
4. **API Communication & Security**: 
   - All backend errors must return structured JSON problem details (`ProblemDetail` / RFC 7807 via `AppError`).
   - The frontend must handle API errors gracefully, typically showing user-friendly toast notifications (`ToastService`) instead of failing silently.
   - When introducing new HTTP methods (e.g., `PATCH`), ensure they are allowed in Axum `CorsLayer` configuration.
5. **Simplicity**: Follow YAGNI principles, and one-liner solutions.
