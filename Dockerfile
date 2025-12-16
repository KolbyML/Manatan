FROM ubuntu:24.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libglib2.0-0 \
    libgtk-3-0 \
    libappindicator3-1 \
    librsvg2-common \
    libxdo3 \
    fuse \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN userdel -r ubuntu || true && \
    useradd -m -u 1000 -s /bin/bash mangatan

WORKDIR /app

ARG TARGETARCH

# Copy artifacts
COPY mangatan-linux-amd64.tar.gz /tmp/amd64.tar.gz
COPY mangatan-linux-arm64.tar.gz /tmp/arm64.tar.gz

# Extract based on architecture
# REMOVED --strip-components=1 to handle flat tarball structure
RUN if [ "$TARGETARCH" = "amd64" ]; then \
        tar -xzf /tmp/amd64.tar.gz -C /app; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        tar -xzf /tmp/arm64.tar.gz -C /app; \
    else \
        echo "Unsupported architecture: $TARGETARCH" && exit 1; \
    fi \
    && rm /tmp/*.tar.gz

# Set permissions
RUN chown -R mangatan:mangatan /app && \
    chmod +x /app/mangatan

USER mangatan

EXPOSE 4568

# Default to headless mode
ENV MANGATAN_HEADLESS=true

# Ensure UTF-8 filesystem encoding for Java
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

ENTRYPOINT ["/app/mangatan"]
