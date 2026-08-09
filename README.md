# Bindog

A dog-themed multiplayer bingo. Match breeds, complete a line, shout **Bindog**.

Play at [bindog.alebatistella.com](https://bindog.alebatistella.com).

Part of the same dog-game family as [Sudog](https://sudog.alebatistella.com/) and [2040dog](https://2040dog.alebatistella.com/).

## How it works

- Each player gets a **5×5** board: **24 dog breeds** plus a **center wild**.
- The room leader announces breeds on a timer; mark matches on your board.
- Win by completing a full **row or column** (diagonals do not count).
- Claiming too early shows a fake-bingo banner; a valid claim ends the round.

Games are **invite-only**. Create or join a room with a short code, wait in the lobby, then play peer-to-peer over **WebRTC**. A Cloudflare Worker handles signaling and TURN credentials only — game state stays on the data channel between clients.

## Technologies used

**App**

- React 19
- TanStack Start / Router
- Vite
- TypeScript
- Tailwind CSS
- Shadcn / Radix UI
- Paraglide (i18n)
- PostHog (analytics)
- Vitest

**Multiplayer**

- WebRTC (RTCDataChannel)
- Cloudflare Workers + Durable Objects (signaling / TURN)

**Locales:** `pt-BR` (base), `en-US`, `fr-FR`, `it-IT`, `de-DE`, `ko-KR`

## How to run

### Prerequisites

- Node.js 24+ (matches CI)
- npm
- For real multiplayer: a Cloudflare account with Realtime TURN (see the [signaling Worker README](workers/bindog-signaling/README.md))

### 1. App

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app listens on [http://localhost:3000](http://localhost:3000).

| Variable | Purpose |
| -------- | ------- |
| `VITE_SIGNALING_URL` | Signaling Worker base URL (local default: `http://127.0.0.1:8787`) |
| `VITE_SITE_URL` | Public site origin used in links / meta |
| `VITE_POSTHOG_KEY` | PostHog project API key (optional for local play) |
| `VITE_POSTHOG_HOST` | PostHog host (e.g. `https://us.i.posthog.com`) |

### 2. Signaling Worker (multiplayer)

Invite rooms need the Worker for TURN minting and WebRTC signaling.

```bash
cd workers/bindog-signaling
cp .env.example .env
# set TURN_KEY_ID and TURN_API_TOKEN
npm install
npm run dev
```

Point the app at the local Worker (`VITE_SIGNALING_URL=http://127.0.0.1:8787` in `.env.local`). Full setup, deploy, and guardrails: [`workers/bindog-signaling/README.md`](workers/bindog-signaling/README.md).

Without TURN secrets, local signaling still works with public STUN (fine on the same LAN).

### Useful scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run test` | Vitest |
| `npm run typecheck` | Paraglide compile + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier + ESLint fix |
| `npm run check` | Prettier check |
| `npm run storybook` | Storybook on port 6006 |

### Shadcn

Add UI primitives with the latest Shadcn CLI:

```bash
pnpm dlx shadcn@latest add button
```

## Deploy

Publishing a GitHub **release** runs [`.github/workflows/deploy.yaml`](.github/workflows/deploy.yaml): tests, Worker deploy (Wrangler), then frontend build + FTP of `dist/client`.

Required repository secrets are documented in that workflow and in the [signaling Worker README](workers/bindog-signaling/README.md).

## Contributing

- [Contribution guide](CONTRIBUTING.md)
- [Support the project](https://www.paypal.com/donate/?hosted_button_id=G2NJKZ5MUMKBS)

## License

[MIT](LICENSE) © Alexandre Batistella Bellas
