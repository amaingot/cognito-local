---
title: "Docker & Docker Compose"
description: "Complete guide to running cognito-local as a Docker container with Docker run and Docker Compose."
---

cognito-local is published as a multi-architecture Docker image supporting both `linux/amd64` and `linux/arm64`. The image is available on GitHub Container Registry.

## Docker run

```bash
docker run -d \
  --name cognito-local \
  -p 9229:9229 \
  -v ./config.json:/config/config.json \
  -v ./users.json:/config/users.json \
  -v ./temp-data:/temp-data \
  ghcr.io/amaingot/cognito-local:latest
```

### Flags explained

| Flag | Purpose |
|---|---|
| `-d` | Run in detached mode (background) |
| `--name cognito-local` | Give the container a name for easy reference |
| `-p 9229:9229` | Map port 9229 on the host to port 9229 in the container |
| `-v ./config.json:/config/config.json` | Mount your configuration file into the container |
| `-v ./users.json:/config/users.json` | Mount your users file into the container |
| `-v ./temp-data:/temp-data` | Persist runtime data (RSA keys, user state) across restarts |

## Docker Compose

```yaml
services:
  cognito:
    image: ghcr.io/amaingot/cognito-local:latest
    ports:
      - "9229:9229"
    volumes:
      - "./config.json:/config/config.json"
      - "./users.json:/config/users.json"
      - "./temp-data:/temp-data"
```

Run with:

```bash
docker compose up -d
```

To include cognito-local alongside your other services, add the `cognito` service to your existing `docker-compose.yml`. Other services can reference it by its service name (e.g., `http://cognito:9229` from within the Docker network).

## Data persistence

cognito-local stores runtime data in the `/temp-data` directory inside the container:

- **RSA key pair** -- Used to sign JWTs. If the keys change, all previously issued tokens become invalid.
- **User data** -- Runtime changes to users (sign-ups, attribute updates) are persisted here.
- **Client data** -- Runtime changes to app clients are persisted here.

By mounting `/temp-data` as a volume, this data survives container restarts. **Without the volume mount, new RSA keys are generated each time the container starts**, which means:

- All existing access tokens, ID tokens, and refresh tokens will fail validation.
- Any application caching the JWKS will need to refetch it.

For local development, mounting a local directory (e.g., `./temp-data`) is the simplest approach.

## Custom port

To run on a different port, set the `PORT` environment variable and update the port mapping:

```bash
docker run -d \
  --name cognito-local \
  -e PORT=8080 \
  -p 8080:8080 \
  -v ./config.json:/config/config.json \
  -v ./users.json:/config/users.json \
  ghcr.io/amaingot/cognito-local:latest
```

## Image tags

The image is published with several tag formats:

| Tag | Description |
|---|---|
| `latest` | Most recent release |
| `0.1.0` | Specific version (pinned) |
| `0.1` | Latest patch release within the 0.1.x minor version |
| `0` | Latest release within the 0.x.x major version |

For reproducible builds, pin to a specific version tag (e.g., `0.1.0`). For local development where you always want the newest version, `latest` is fine.

## Verifying the container is running

After starting the container, verify it is healthy:

```bash
curl -s http://localhost:9229/us-east-1_localDev01/.well-known/openid-configuration | jq
```

This should return the OpenID Connect discovery document with the issuer, token endpoint, and other metadata.
