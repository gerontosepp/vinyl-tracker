---
trigger: always_on
---

---
trigger: always_on
---

1. **Backend Tech Stack & Architecture**: 
   - Use Java 21+ and Spring Boot.
   - Use Lombok for boilerplate code (e.g., `@Data`, `@RequiredArgsConstructor`).
   - Enforce a strict layered architecture: Controllers must only handle HTTP routing and delegate logic to Services. Services contain business logic. Repositories handle data access.
2. **Frontend Tech Stack & Architecture**: 
   - Use React (Vite/TypeScript) with functional components and hooks. 
   - Avoid Redux; prefer React Context for global state and custom hooks for local logic.
   - Use Tailwind CSS for styling via utility classes. Avoid custom CSS unless absolutely necessary (e.g., complex keyframe animations in `index.css`).
3. **Date & Time Convention (CRITICAL)**:
   - Use ISO 8601 format for all date and time representations.
   - Database and Backend operations MUST ALWAYS use UTC (`LocalDateTime` in Java).
   - Frontend must receive UTC from the API but MUST display local time to the user (`Date` object in JS/TS).
4. **API Communication**: 
   - All backend errors must return structured JSON problem details.
   - The frontend must handle API errors gracefully, typically showing user-friendly toast notifications instead of failing silently.
