FROM ubuntu:24.04

# Install dependencies required by your Rust binary (GTK, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libglib2.0-0 \
    libgtk-3-0 \
    libappindicator3-1 \
    librsvg2-common \
    libxdo3 \
    fuse \
    && rm -rf /var/lib/apt/lists/*

RUN userdel -r ubuntu || true && \
    useradd -m -u 1000 -s /bin/bash mangatan

WORKDIR /app

ARG TARGETARCH

# These files are now guaranteed to exist because we waited for CI to finish
COPY mangatan-linux-amd64.tar.gz /tmp/amd64.tar.gz
COPY mangatan-linux-arm64.tar.gz /tmp/arm64.tar.gz

RUN if [ "$TARGETARCH" = "amd64" ]; then \
        tar -xzf /tmp/amd64.tar.gz -C /app --strip-components=1; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        tar -xzf /tmp/arm64.tar.gz -C /app --strip-components=1; \
    else \
        echo "Unsupported architecture: $TARGETARCH" && exit 1; \
    fi \
    && rm /tmp/amd64.tar.gz /tmp/arm64.tar.gz

USER mangatan

ENTRYPOINT []
EXPOSE 4568
CMD ["./mangatan", "--headless"]
