# Infrastructure

The Compose stack terminates TLS, proxies WebSocket traffic over WSS, and ships a TURN/STUN
setup for reliable WebRTC.

## Services

- **reverse-proxy (Traefik)** — forces HTTPS, upgrades WebSocket connections to WSS, and applies
  strict security headers. Mount your TLS keypair to `traefik/certs/tls.crt` and
  `traefik/certs/tls.key`.
- **backend** — FastAPI application published only via Traefik on port 443.
- **frontend** — Vite dev server proxied through Traefik with HTTPS.
- **turn (coturn)** — TURN/STUN server with TLS (`turns:`) enabled.

## Usage

1. Copy `.env.example` to `.env` in the `infra/` directory and fill in real domains and TURN
   credentials. Secrets stay outside the repository thanks to the root `.gitignore` entry for
   `.env` files.
2. Place your TLS certificate and key in `traefik/certs/tls.crt` and `traefik/certs/tls.key`.
   Traefik will redirect all HTTP requests to HTTPS and serve WebSockets via WSS automatically.
3. If the TURN server is behind NAT, add `--external-ip=<public_ip>` to `TURN_EXTRA_OPTS` inside
   `.env`.
4. Start the stack from the `infra/` directory: `docker compose up -d`.

The backend receives `STUN_SERVERS` and `TURN_SERVERS` from the environment and can return them to
clients via `/config/webrtc` without exposing TURN credentials in responses.
