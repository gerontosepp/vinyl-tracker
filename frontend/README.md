# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.27.

This is the Angular 19 PWA frontend for Vinyl Tracker (the frontend built and deployed by Docker Compose). See the [root README](../README.md) for full setup, SSL, and Docker instructions.

## Development server

To start a local development server, run:

```bash
npm run dev
```

This runs `ng serve --port 5173` with the API proxy configured. Open your browser at `https://localhost:5173/` (HTTPS is required for the barcode-scanner webcam access). The application reloads whenever you modify source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

The project enforces >80% code coverage for core services, utilities, and components.

## Running end-to-end tests

End-to-end tests use [Playwright](https://playwright.dev). The application stack must be running locally first.

```bash
npm run test:e2e
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
