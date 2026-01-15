FROM debian:bookworm-slim AS base

ARG BUILD_ENV=dev

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    BUILD_ENV=${BUILD_ENV}

# Install dependencies
RUN set -eux; \
    apt-get update; \
    apt-get upgrade -y; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      wget \
      git \
      build-essential \
      pkg-config \
      libssl-dev \
      bash \
      cmake \
      libsasl2-dev \
      libzstd-dev \
      netcat-openbsd \
      curl \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    \
    # Install Rust
    curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain stable; \
    \
    ln -sf "${CARGO_HOME}/bin/cargo" /usr/local/bin/cargo; \
    ln -sf "${CARGO_HOME}/bin/rustc" /usr/local/bin/rustc; \
    ln -sf "${CARGO_HOME}/bin/rustup" /usr/local/bin/rustup

# Install cargo-watch for development
RUN if [ "$BUILD_ENV" = "dev" ]; then \
      cargo install cargo-watch; \
    fi

WORKDIR /home/rust/ws_gateway

EXPOSE 9998 9997

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]
