# Export Controls Dependency Map — Real Rails

> **Rail:** Governance & Trust | **Stack:** Next.js 15 + FastAPI + DeckGL + UN Comtrade + USGS MRDS

A geospatial intelligence **prototype** dashboard that maps global export-control dependency networks across critical minerals and dual-use technologies.

> **Data status:** The dashboard connects to **two live APIs** — UN Comtrade (authenticated via `COMTRADE_API_KEY` in `backend/.env`) and USGS MRDS WFS (US Government public endpoint, no key required). `mock_data.json` is retained as an automatic fallback per source if either live API fails. Risk scores and EAR/ITAR flags are formula-derived thresholds — they are **not** lookups against actual EAR/ITAR/OFAC regulatory databases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 · TypeScript)                     │
│  ┌─────────────────────────┐  ┌────────────────────┐    │
│  │   MapStage (70%)        │  │ IntelligenceSidebar│    │
│  │   DeckGL ArcLayer       │  │ (30%)              │    │
│  │   + ScatterplotLayer    │  │ Filters · KPIs     │    │
│  │   MapLibre dark basemap │  │ Risk Chart         │    │
│  └─────────────────────────┘  └────────────────────┘    │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP (localhost:8000)
┌───────────────────────▼─────────────────────────────────┐
│  Backend (FastAPI · Python)                             │
│                                                         │
│  ┌─────────────────┐    ┌──────────────────────┐        │
│  │ UN Comtrade     │    │ USGS MRDS            │        │
│  │ Adapter ✅ Live │    │ Adapter ✅ Live      │        │
│  │ (key configured)│    │ (public, no key)     │        │
│  └────────┬────────┘    └──────────┬───────────┘        │
│           └──────────┬─────────────┘                    │
│              ┌───────▼──────┐                           │
│              │ In-Memory    │                           │
│              │ Cache 30min  │                           │
│              └───────┬──────┘                           │
│              Fallback: mock_data.json (per-source)      │
└──────────────────────┴──────────────────────────────────┘
```

---


## Setup & Quick Start

### 1. Clone / open the project

```powershell
# If you haven't already, navigate to the project root
cd "Export Controls"
```

### 2. Backend

```powershell
cd backend

# Create and activate a virtual environment (recommended)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
# → API available at http://localhost:8000
# → Interactive docs at http://localhost:8000/docs
```

> **Note:** The backend will start successfully with or without an API key — without a Comtrade key the adapter falls back to `mock_data.json` automatically. USGS MRDS requires no key and is always attempted live.

#### Comtrade API key (already configured in this project)

The UN Comtrade authenticated endpoint (`data/v1/get`) requires a subscription key sent as `Ocp-Apim-Subscription-Key`. This project ships with a key in `backend/.env`.

**To replace or refresh the key:**
1. Register / log in at [comtradeplus.un.org](https://comtradeplus.un.org)
2. Go to **Subscribe → copy Primary Key**
3. Update `backend/.env`:
   ```
   COMTRADE_API_KEY=your_primary_key_here
   ```
The `fetch_comtrade_live()` function in `main.py` already passes the key as the `Ocp-Apim-Subscription-Key` header automatically.

### 3. Frontend

```powershell
# Open a new terminal, from the project root:
cd frontend

# Install dependencies (first run only — takes ~1 min)
npm install

# Copy and configure environment variables
copy .env .env.local
# Edit .env.local and set a valid MapLibre / Maptiler key if needed.
# The basemap uses a public CartoBasemaps URL, so no key is required
# for the dark-matter style used by default.

# Start the dev server
npm run dev
# → Frontend available at http://localhost:3000
```

> **Both servers must be running simultaneously** — the frontend fetches from `localhost:8000`.

---

## Environment Variables & API Keys

### Required API Keys Summary

| API / Service | Key Required? | Where to Get | Status |
|--------------|--------------|-------------|--------|
| **UN Comtrade** (`comtradeapi.un.org/data/v1/get`) | ✅ Yes — `COMTRADE_API_KEY` | [comtradeplus.un.org](https://comtradeplus.un.org) → Subscribe → Primary Key | ✅ Configured in `backend/.env` |
| **USGS MRDS WFS** (`mrdata.usgs.gov/cgi-bin/mapserv`) | ❌ No | Public US Gov endpoint | ✅ No key needed |
| **CartoBasemaps** (map tiles) | ❌ No | Public CDN | ✅ No key needed |
| **MapBox** | ❌ No | N/A | `NEXT_PUBLIC_MAPBOX_TOKEN` is an unused legacy placeholder — basemap uses CartoBasemaps |

### `frontend/.env`

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | **No** | — | Legacy placeholder only — **not used**. Basemap uses public CartoBasemaps dark-matter URL |

### `backend/.env`

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `COMTRADE_API_KEY` | **Yes** (for live data) | Falls back to mock | UN Comtrade `Ocp-Apim-Subscription-Key`. Get from [comtradeplus.un.org](https://comtradeplus.un.org) |

---

## Data Sources & Current Status

| Source | Intended Type | Current Status | Notes |
|--------|--------------|----------------|-------|
| **UN Comtrade** | Live (authenticated) | ✅ Active — key configured | `Ocp-Apim-Subscription-Key` sent to `comtradeapi.un.org/data/v1/get/C/A/HS` |
| **USGS MRDS** | Live (WFS public) | ✅ Active — no key required | `mrdata.usgs.gov/cgi-bin/mapserv` WFS 1.0.0 / GML2, public US Gov endpoint |
| **Mock Data** | Per-source fallback | ✅ Standby | `backend/mock_data.json` auto-activates if either live API fails or returns no records |

---

## Risk Scores & EAR/ITAR Flags — Important Disclaimer

Risk scores and restriction flags are **not** sourced from official regulatory databases:

- **Comtrade records:** `riskScore = min(95, 40 + int(fob_volume_millions / 50))` — volume-proportional formula
- **USGS records:** hardcoded per-mineral table (e.g. Cobalt → 94, Rare earths → 91)
- **Restriction flag:** `restricted = riskScore > 70` — a simple threshold, not an EAR/ITAR/OFAC lookup
- **EAR/ITAR reason strings:** static labels appended when the threshold is exceeded

These scores are useful for **visual prioritisation** in a prototype context. They should not be used for compliance decisions.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dependencies` | All dependency links (Comtrade + USGS merged, falls back to mock) |
| `GET` | `/api/dependencies/comtrade` | Comtrade links only |
| `GET` | `/api/dependencies/usgs` | USGS MRDS links only |
| `GET` | `/api/stats` | KPI metrics |
| `GET` | `/api/risk-scores` | Avg risk score per commodity |
| `GET` | `/api/country-compare` | Export dominance & vulnerability scores |
| `GET` | `/api/mitigations` | Strategic mitigation pathways |
| `GET` | `/api/source-labels` | Data provenance metadata |
| `GET` | `/api/cache/status` | Cache age & freshness |
| `POST` | `/api/cache/invalidate` | Force-refresh live data caches |
| `GET` | `/health` | Health check |

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---


### Interaction Model

- **Click a country node** → sidebar filters to that country's flows
- **Hover an arc** → tooltip shows: route, component, risk score, restriction reason, data source
- **Component filter pills** → multi-select chips filter arcs in real time
- **"All" pill** → clears all filters

---

## Project Structure

```
Export Controls/
├── backend/
│   ├── main.py              # FastAPI app + Comtrade & USGS adapters
│   ├── mock_data.json        # Active synthetic fallback data (12 links)
│   └── requirements.txt
├── frontend/
│   ├── .env                 # Environment variable template
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css   # Design DNA (tokens, utilities)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx         # 70/30 layout orchestrator
│   │   │   ├── MapStage.tsx          # DeckGL geo visualization
│   │   │   ├── IntelligenceSidebar.tsx # Filters + KPIs + insights
│   │   │   └── RiskChart.tsx         # Recharts bar chart
│   │   └── lib/utils.ts
│   ├── next.config.ts
│   └── package.json
├── VAR_Report.md             # Visualization Audit Report (against mock data)
├── UAT_Table.md              # Functional UAT (against mock data)
└── README.md
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Frontend shows no data / blank map | Backend not running | Start `python main.py` in `backend/` |
| `npm install` fails | Node < 18 or npm < 9 | Upgrade Node.js |
| Backend 500 on startup | Missing `mock_data.json` | Ensure `backend/mock_data.json` exists |
| Comtrade returns 0 records / 403 | Expired or invalid API key | Refresh `COMTRADE_API_KEY` in `backend/.env` — get from [comtradeplus.un.org](https://comtradeplus.un.org) |
| Comtrade returns 429 | Rate limit hit | Backend auto-stops further requests. Wait or use `POST /api/cache/invalidate` after cooldown |
| USGS returns empty features | WFS filter match issue | Backend falls back to calibrated baseline values per mineral — no action needed |
| Map tiles not loading | Network issue with CartoBasemaps CDN | Check internet connection; no key needed for CartoBasemaps dark-matter style |

---


## Caching Strategy

Live data is cached in-memory for **30 minutes** per source to avoid rate-limiting. Use `POST /api/cache/invalidate` to force a fresh pull.

```
Request → Cache hit? → Return cached data (fast)
               ↓ No
         Attempt UN Comtrade live fetch
         Attempt USGS MRDS live fetch
         Merge + store in cache
         Return data
               ↓ Any error / 403
         Fallback to mock_data.json  ← only if live API fails/empty
```

---

