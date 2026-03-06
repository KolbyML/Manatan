# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM busybox:1.36 AS unpack
WORKDIR /out/app
ARG TARGETARCH

COPY manatan-linux-amd64.tar.gz /tmp/amd64.tar.gz
COPY manatan-linux-arm64.tar.gz /tmp/arm64.tar.gz

RUN set -eux; \
    if [ "$TARGETARCH" = "amd64" ]; then \
      tar -xzf /tmp/amd64.tar.gz -C /out/app; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
      tar -xzf /tmp/arm64.tar.gz -C /out/app; \
    else \
      echo "Unsupported architecture: $TARGETARCH" >&2; exit 1; \
    fi

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libglib2.0-0 \
    libgtk-3-0 \
    libappindicator3-1 \
    librsvg2-common \
    libxdo3 \
    fuse \
 && rm -rf /var/lib/apt/lists/*

# Create the user + home
RUN userdel -r ubuntu || true && \
    useradd -m -u 1000 -s /bin/bash manatan

WORKDIR /app
COPY --from=unpack --chown=1000:1000 /out/app/ /app/

RUN chmod +x /app/manatan

USER 1000:1000

EXPOSE 4568
ENV MANATAN_HEADLESS=true
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

ENTRYPOINT ["/app/manatan"]
