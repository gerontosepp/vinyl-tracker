# syntax=docker/dockerfile:1

# Stage 0: Multi-arch cross-compilation helpers
FROM --platform=$BUILDPLATFORM tonistiigi/xx:1.6.1 AS xx

# Stage 1: Chef base on the native host builder platform (eliminates QEMU crashes and runs at native speed)
FROM --platform=$BUILDPLATFORM lukemathwalker/cargo-chef:latest-rust-bookworm AS chef
COPY --from=xx / /
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang \
    lld \
    && rm -rf /var/lib/apt/lists/*
ARG TARGETPLATFORM
RUN xx-apt-get install -y xx-c-essentials
WORKDIR /app

# Stage 2: Recipe planner (runs natively on build platform)
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Builder with cached dependency compilation (runs on build platform, cross-compiles to TARGETPLATFORM)
FROM chef AS builder
ARG TARGETPLATFORM
COPY --from=planner /app/recipe.json recipe.json
RUN xx-cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN xx-cargo build --release --bin backend-rs && \
    cp target/$(xx-cargo --print-target-triple)/release/backend-rs /backend-rs && \
    xx-verify /backend-rs

# Stage 4: Minimal runner image (target platform)
FROM debian:bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS/TLS, curl for container healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /backend-rs /app/backend-rs
COPY migrations /app/migrations

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["/app/backend-rs"]
