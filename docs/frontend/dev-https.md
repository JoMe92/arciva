# Local HTTPS for Arciva PWA Testing

Chrome and Safari only expose the PWA install prompt when the site is served from a secure origin. Use the following workflow to run the Vite dev server over HTTPS with a certificate that devices on your LAN trust.

## 1. Install mkcert & Trust Its CA

| OS      | Command(s)                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------- |
| macOS   | `brew install mkcert nss`                                                                       |
| Windows | `choco install mkcert` (from an elevated PowerShell prompt)                                     |
| Linux   | `sudo apt install libnss3-tools` and `curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/amd64 && chmod +x mkcert && sudo mv mkcert /usr/local/bin/` |

After installation, run `mkcert -install` to place the local Certificate Authority into your OS and browser trust stores.

> Firefox needs the `nss` tooling (already covered above) so mkcert can import the CA into its separate certificate store.

## 2. Generate a Certificate

1. Optionally add a stable hostname (e.g., `arciva.local`) that points to your development machine in `/etc/hosts` or your router DNS.
2. Run mkcert from the repo root (adjust hosts/IPs to match your LAN):

```bash
mkdir -p frontend/.certs
mkcert -key frontend/.certs/arciva-key.pem -cert frontend/.certs/arciva-cert.pem arciva.local 127.0.0.1 192.168.178.20
```

The generated files stay outside version control by default (the `.certs` folder is untracked).

## 3. Configure Vite

Create `frontend/.env.local` (or update the existing file) with:

```
DEV_SERVER_HTTPS=true
DEV_SERVER_HTTPS_KEY=frontend/.certs/arciva-key.pem
DEV_SERVER_HTTPS_CERT=frontend/.certs/arciva-cert.pem
```

These variables toggle the `https` block in `vite.config.ts`. Relative paths are resolved from the workspace root.

## 4. Start the Dev Server

```bash
cd frontend
pnpm dev -- --host arciva.local
```

Open `https://arciva.local:5173` (or the LAN IP bound in mkcert) from desktop Chrome first to confirm the lock icon. Mobile devices on the same network that trust the mkcert CA (install `mkcert -install` on those devices if supported, or export the CA file) can now access the HTTPS endpoint and receive the proper “Install app” UI.

### Prefer One Command?

If you need the backend, worker, and HTTPS frontend together, run:

```bash
pixi run dev-stack-pwa
```

This wraps `./dev.sh up`, sets `ENABLE_PWA_DEV=true`, and binds the Vite dev server to `arciva.local` so the service worker runs exactly like production while the rest of the stack stays unchanged.

## 5. Production Preview

Run `pnpm build && pnpm preview -- --host arciva.local` to mimic production. The preview server reuses the same HTTPS configuration variables.

> **Tip:** Always re-test installability from the HTTPS origin after changing icons, manifest fields, or service-worker caching strategies so Chrome refreshes its install heuristics.
