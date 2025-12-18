FROM debian:bookworm-slim AS base

LABEL org.opencontainers.image.source=https://github.com/rust-lang/docker-rust

ARG BUILD_ENV=${BUILD_ENV}

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    RUST_VERSION=1.92.0 \
    BUILD_ENV=${BUILD_ENV}

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      wget \
      git \
      build-essential \
      pkg-config \
      libssl-dev \
      bash \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    \
    export RUSTUP_HOME="${RUSTUP_HOME}"; \
    export CARGO_HOME="${CARGO_HOME}"; \
    curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}"; \
    \
    ln -sf "${CARGO_HOME}/bin/cargo" /usr/local/bin/cargo; \
    ln -sf "${CARGO_HOME}/bin/rustc" /usr/local/bin/rustc; \
    ln -sf "${CARGO_HOME}/bin/rustup" /usr/local/bin/rustup; \
    \
    rustup --version; \
    cargo --version; \
    rustc --version

# Copy cargo config
COPY cargo.config.toml /usr/local/cargo/config.toml

COPY install.dev.sh /usr/local/bin/install.dev.sh
COPY install.prod.sh /usr/local/bin/install.prod.sh
RUN chmod +x /usr/local/bin/install.dev.sh /usr/local/bin/install.prod.sh

RUN if [ "$BUILD_ENV" = "dev" ]; then \
      /usr/local/bin/install.dev.sh; \
    else \
      /usr/local/bin/install.prod.sh; \
    fi

WORKDIR /home/rust/money_flow

EXPOSE 8888

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]