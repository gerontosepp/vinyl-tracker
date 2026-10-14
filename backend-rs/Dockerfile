# Build stage
FROM rust:bookworm AS builder
WORKDIR /app

# Copy dependency manifests
COPY Cargo.toml Cargo.lock* ./
COPY migrations ./migrations
COPY src ./src

# Build release binary
RUN cargo build --release

# Minimal runner stage
FROM debian:bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS/TLS, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary and migrations
COPY --from=builder /app/target/release/backend-rs /app/backend-rs
COPY migrations /app/migrations

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["/app/backend-rs"]
