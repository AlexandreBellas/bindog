# Bindog signaling Worker

Cloudflare Worker that mints short-lived TURN credentials and relays WebRTC signaling for invite-only Bindog rooms.

## Endpoints

| Method | Path                | Role                                                  |
| ------ | ------------------- | ----------------------------------------------------- |
| `POST` | `/turn/credentials` | Mint ICE servers via Cloudflare Realtime TURN         |
| `POST` | `/rooms`            | Create a room → `{ code, name }`                      |
| `GET`  | `/rooms/:code`      | Existence check                                       |
| `WS`   | `/rooms/:code`      | Signaling relay (join / offer / answer / ice / leave) |

## One-time Cloudflare setup

1. Create / log into a [Cloudflare account](https://dash.cloudflare.com/).
2. Install deps and log Wrangler into that account:

```bash
cd workers/bindog-signaling
npm install
npx wrangler login
```

3. Create a **Realtime TURN** key:
    - Dashboard → **Realtime** → **TURN** → create a key
    - Copy the **Key ID** and create an **API token** for that key
4. Store them as Worker secrets (never commit these):

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_API_TOKEN
```

## Local development

```bash
npm run dev
```

Point the app at the local Worker:

```bash
# in bindog/.env.local
VITE_SIGNALING_URL=http://127.0.0.1:8787
```

## Manual deploy

```bash
npm run deploy
```

Wrangler prints a URL like `https://bindog-signaling.<account>.workers.dev`.

Then set the frontend env:

```bash
# local
VITE_SIGNALING_URL=https://bindog-signaling.<account>.workers.dev

# GitHub Actions frontend deploy secret
VITE_SIGNALING_URL=https://bindog-signaling.<account>.workers.dev
```

Optional: attach a custom domain in the Worker settings (e.g. `signaling.bindog.example.com`) and use that as `VITE_SIGNALING_URL`.

## Deploy with GitHub Actions

On each published release, [`.github/workflows/deploy.yaml`](../../.github/workflows/deploy.yaml) deploys the Worker first, then the frontend.

Add these repository secrets:

| Secret | Where to get it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Dashboard → My Profile → API Tokens → create token with **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → right sidebar Account ID |
| `VITE_SIGNALING_URL` | Worker URL after first deploy (e.g. `https://bindog-signaling.<account>.workers.dev`) |

Set TURN secrets once (not on every CI run):

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_API_TOKEN
```

CI only needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` to run `wrangler deploy`. The frontend job still injects `VITE_SIGNALING_URL` at build time.

## Notes

Rooms live in Worker memory. That is fine for low-concurrency invite lobbies; recreate the room if the isolate restarts.
