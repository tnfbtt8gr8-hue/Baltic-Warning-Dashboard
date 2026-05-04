# Baltic Warning Dashboard Architecture

## Overview
This release is a lightweight Vercel deployment made of two parts:

1. **Static frontend**
   - `index.html`
   - `dashboard.html`
   - `assets/app.js`
   - `assets/styles.css`

2. **Serverless backend**
   - `api/*.js`
   - `api/_lib/*.js`

The design goal is simple deployment, low maintenance, and beginner-friendly hosting on GitHub + Vercel.

## Data flow
1. User opens `/dashboard`
2. Frontend calls:
   - `/api/assessments/latest`
   - `/api/ccir`
   - `/api/pirs`
   - `/api/sirs`
   - `/api/sources`
   - `/api/red-flags`
   - `/api/signals`
3. API reads seed data and stored signals
4. Dashboard renders current assessment and signal list

## Crawling flow
1. Vercel Cron calls `/api/crawlers/run-all`
2. Route validates `Authorization: Bearer <CRON_SECRET>`
3. Crawlers fetch public sources
4. Signals are normalized and deduplicated
5. Risk engine computes new assessment
6. Data is stored in KV if configured, otherwise best-effort file + memory fallback

## Storage
### Recommended production storage
- Vercel KV / Upstash REST
- configured via:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

### Fallback storage
- `data/signals.json`
- `data/assessment.json`
- in-memory runtime fallback

The fallback is useful locally, but persistent storage is recommended on Vercel.

## Security model
- Cron endpoint protected with `CRON_SECRET`
- Manual UI-triggered crawl can use `x-admin-secret`
- No privileged connectors or hidden access paths
- Public-source only collection logic

## Main modules
- `api/_lib/seed.js` — doctrine, CCIR, PIR, SIR, source asset registry
- `api/_lib/crawlers.js` — source collectors and normalization
- `api/_lib/risk.js` — assessment scoring and warning logic
- `api/_lib/store.js` — persistence abstraction
- `api/_lib/service.js` — orchestration layer

## Deployment model
- GitHub repo
- Import into Vercel
- No build step required
- Static pages + serverless APIs
