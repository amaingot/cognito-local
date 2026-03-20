---
title: Environment Variables
description: Reference for all environment variables supported by cognito-local.
---

cognito-local reads the following environment variables at startup. Environment variables take the highest precedence in the [configuration loading order](/configuration/overview/).

## Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9229` | Server listen port. Overrides `port` in config.json. |
| `CONFIG_FILE` | `/config/config.json` | Path to the configuration JSON file. |
| `USERS_FILE` | `/config/users.json` | Path to the users JSON file. |
| `DATA_DIR` | `/temp-data` | Directory for persistent data (RSA keys, user pools, clients). |

## Docker defaults

When running in Docker, these defaults align with the container's filesystem layout. The Dockerfile sets up `/config/` for configuration files and `/temp-data/` for persistent data, so the defaults work out of the box.

To override them in Docker:

```bash
docker run \
  -e PORT=8080 \
  -e DATA_DIR=/data \
  -p 8080:8080 \
  ghcr.io/amaingot/cognito-local:latest
```

You can also mount custom config files:

```bash
docker run \
  -v ./my-config.json:/config/config.json \
  -v ./my-users.json:/config/users.json \
  -p 9229:9229 \
  ghcr.io/amaingot/cognito-local:latest
```

## Local development

For local development (outside Docker), the default paths `/config/config.json` and `/config/users.json` typically do not exist. When these files are not found, the server logs a message and uses built-in defaults. The example files at `config/config.example.json` and `config/users.example.json` in the repository can be used as a starting point.

To use custom files during local development, set the env vars before starting the server:

```bash
CONFIG_FILE=./config/config.example.json \
USERS_FILE=./config/users.example.json \
npm run dev
```

## How overrides work

`PORT` and `DATA_DIR` override the corresponding fields in the config JSON file. The resolution order is:

1. Environment variable (if set)
2. Value from config.json (if present)
3. Built-in default

The `issuerHost` is derived from the resolved port as `http://localhost:{PORT}` unless explicitly configured in config.json. This means setting `PORT=8080` also changes the issuer host to `http://localhost:8080` (assuming `issuerHost` is not set in the config file).
