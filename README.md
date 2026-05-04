# Baltic Warning Dashboard v4.0.2

Vercel-ready warning dashboard with a doctrinal decision-support model:

Mission / Commander intent → Decision Point → CCIR → PIR → Indicator → Collection SIR → NAI / LTIOV / Collector → Evidence → Assessment / Recommendation.

## v4.0.2 highlights

- Replaces the old nested CCIR folder view with **Decision Board**.
- Adds **Collection Workshop** for PIR → Indicator → Collection SIR → NAI → LTIOV → Collector → Evidence workflow.
- Adds FFIR context under each CCIR.
- Adds ontology model extraction for Event, Time, Place, People, Organizations and Objects.
- Adds 1–5 confidence / reliability scoring: 1 = low, 5 = high.
- Adds a zoomable/pannable base map covering EU countries, nearby states and Russia with approximate capital points.
- Adds NAI overlays and latest event markers when incoming feeds contain location clues.
- Keeps movable/resizable dashboard panels and local layout persistence.
- Keeps local UI fallback for custom crawlers; server-side persistence for custom crawlers requires Vercel KV/Redis.

## Vercel environment variables

Recommended:

```text
CRON_SECRET=<strong secret>
ENABLE_REMOTE_FETCH=true
KV_REST_API_URL=<optional Vercel KV / Upstash URL>
KV_REST_API_TOKEN=<optional Vercel KV / Upstash token>
```

`vercel.json` runs crawlers hourly using Vercel Cron:

```json
{ "path": "/api/crawlers/run-all", "schedule": "0 * * * *" }
```

## Local checks

```bash
npm run check
```


## v4.0.2 NAI / collection plan alignment

This build adds a complete Baltic warning NAI set and ensures each NAI has at least one Collection SIR in the collection plan:

- NAI-01 Kola / Murmansk / Northern Fleet
- NAI-02 St Petersburg / Gulf of Finland
- NAI-03 Narva / Ivangorod / Estonia NE border
- NAI-04 Pskov / Luga approach
- NAI-05 Latvia eastern border / Daugavpils axis
- NAI-06 Suwalki / Grodno / Brest corridor
- NAI-07 Kaliningrad / Baltiysk / Chernyakhovsk
- NAI-08 Baltic Sea / Gulf of Riga / maritime axis
- NAI-09 Belarus staging / Minsk-Baranovichi-Brest
- NAI-10 Baltic capitals / cyber-information nodes

Crawler output is matched to NAIs through the ontology and place/keyword resolver. If an incoming feed does not include a usable place cue, the item remains in Signals/Evidence but is not plotted as an event marker. The NAI layer itself always loads on the map.
