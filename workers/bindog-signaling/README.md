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

`wrangler secret put` only applies to the **deployed** Worker. For local `wrangler dev`, copy the example vars file and fill in the same TURN values:

```bash
cp .env.example .env
# edit .env → TURN_KEY_ID + TURN_API_TOKEN
npm run dev
```

Without `.env`, `/turn/credentials` still succeeds with public STUN only (fine for same-LAN testing; use real TURN for cross-network peers).

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

| Secret                  | Where to get it                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Dashboard → My Profile → API Tokens → create token with **Edit Cloudflare Workers**   |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → right sidebar Account ID                                |
| `VITE_SIGNALING_URL`    | Worker URL after first deploy (e.g. `https://bindog-signaling.<account>.workers.dev`) |

Set TURN secrets once (not on every CI run):

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_API_TOKEN
```

CI only needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` to run `wrangler deploy`. The frontend job still injects `VITE_SIGNALING_URL` at build time.

## Notes

Each room runs in a **Durable Object** so every peer WebSocket for that invite code shares one instance. That is required for `peer-joined` / signal relay / leadership transfer between clients.

Without a DO, Worker isolates cannot reliably push messages onto another request's WebSocket — joiners would see the roster from their own `joined` payload while the leader never learned anyone arrived.

Room metadata lives in DO storage for the lifetime of that object; recreate the room if you wipe local DO state.
