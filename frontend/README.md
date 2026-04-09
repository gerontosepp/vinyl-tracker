# Frontend (Vinyl Tracker)

React + TypeScript + Vite frontend for Vinyl Tracker.

## Voraussetzungen

- Node.js 20+
- npm 10+

## Setup

```bash
cd frontend
npm install
```

Optional fuer lokale HTTPS-Entwicklung mit Kamerazugriff:

```bash
mkdir -p certs
# Zertifikate wie im Root-README beschrieben erzeugen
```

## Wichtige Skripte

```bash
# Dev server
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Linting
npm run lint

# Formatierung
npm run format

# Unit/Integration tests
npm run test -- --run

# E2E tests
npm run test:e2e
```

## Architektur-Hinweise

- Routing und Route-Guards sind in `src/App.tsx` definiert.
- Globale Auth-Logik liegt im Context (`src/context/AuthContext.tsx`).
- API-Zugriffe laufen zentral ueber `src/services/api.ts`.
- Dashboard-Charts beziehen Live-Daten aus:
  - `GET /api/analytics/collection/value`
  - `GET /api/analytics/collection/genres`

## Tests

- Test-Framework: Vitest + React Testing Library
- E2E: Playwright
- Coverage-Schwellen sind in `vite.config.ts` hinterlegt (linienbasiert >= 80%).

## Hinweise zu Auth

- Primar nutzt das Frontend HttpOnly-Cookie-basierte Authentifizierung (`withCredentials: true`).
- Fuer Umgebungen mit eingeschraenkter Cookie-Propagation ist ein Bearer-Token-Fallback aktiviert.
