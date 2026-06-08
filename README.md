# Export Controls Dependency Map — Real Rails

> **Rail:** Governance & Trust | **Stack:** Next.js 15 + FastAPI + DeckGL + UN Comtrade + USGS MRDS

A geospatial intelligence **prototype** dashboard that maps global export-control dependency networks across critical minerals and dual-use technologies.

> ⚠️ **Data status:** The dashboard currently runs entirely on **synthetic mock data** (`backend/mock_data.json`). The UN Comtrade public preview endpoint returns HTTP 403 without an API key, and the USGS MRDS WFS adapter has not been verified. Live API adapters are implemented in `backend/main.py` and will activate automatically once a valid Comtrade subscription key is configured. Risk scores and EAR/ITAR flags are formula-derived thresholds — they are **not** lookups against actual EAR/ITAR/OFAC regulatory databases.

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
│  │ Adapter (403)   │    │ Adapter (unverified) │        │
│  └────────┬────────┘    └──────────┬───────────┘        │
│           └──────────┬─────────────┘                    │
│              ┌───────▼──────┐                           │
│              │ In-Memory    │                           │
│              │ Cache 30min  │                           │
│              └───────┬──────┘                           │
│                      │  Active: mock_data.json          │
└──────────────────────┴──────────────────────────────────┘
```

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Python | 3.10+ | `python --version` |
| pip | 23+ | `pip --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

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

> **Note:** The backend will start successfully without any API keys. All responses fall back to `mock_data.json` automatically.

#### Optional — Comtrade API key (for live data)

The UN Comtrade public preview endpoint requires a subscription key for production use. Without one the adapter returns a 403 and falls back to mock data.

1. Register a free account at [comtradeplus.un.org](https://comtradeplus.un.org)
2. Copy your subscription key
3. Create `backend/.env`:
   ```
   COMTRADE_API_KEY=your_key_here
   ```
4. Update `main.py` to pass the key as an `Ocp-Apim-Subscription-Key` header in the `httpx` requests inside `fetch_comtrade_live()`.

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

## Environment Variables

### `frontend/.env`

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | — | Legacy token placeholder. Not used — basemap uses public CartoBasemaps URL |

### `backend/.env` (create manually if needed)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `COMTRADE_API_KEY` | No | — | UN Comtrade subscription key. Without it, mock data is used |

---

## Data Sources & Current Status

| Source | Intended Type | Current Status | Notes |
|--------|--------------|----------------|-------|
| **UN Comtrade** | Live | ❌ 403 — not active | Needs subscription key at `comtradeplus.un.org` |
| **USGS MRDS** | Live (WFS) | ⚠️ Unverified | WFS endpoint may require map file path fixes |
| **Mock Data** | Fallback | ✅ Active | `backend/mock_data.json` — 12 synthetic dependency links |

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

## Frontend Layout — 70/30 Split

```
┌─────────────────────────────────────────┬──────────────┐
│                                         │              │
│           MapStage (70%)                │ Intelligence │
│                                         │ Sidebar(30%) │
│  • DeckGL ArcLayer (trade flow arcs)    │              │
│  • ScatterplotLayer (country nodes)     │  KPIs        │
│  • MapLibre dark-matter basemap         │  Filters     │
│  • Click node → sidebar filter          │  Risk Chart  │
│  • Hover arc → tooltip with metadata   │  Mitigations │
│                                         │  Download    │
└─────────────────────────────────────────┴──────────────┘
```

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
| Comtrade returns 0 records | 403 — no API key | Add `COMTRADE_API_KEY` to `backend/.env` |
| Map tiles not loading | Network issue with CartoBasemaps CDN | Check internet connection; no key needed for CartoBasemaps dark-matter style |

---

## Design DNA

| Token | Value |
|-------|-------|
| Background | `#030712` (strictly enforced in `:root`, `.dark`, and `body`) |
| Primary accent | `#38BDF8` (cyan) |
| Secondary accent | `#818CF8` (indigo) |
| Danger | `#ef4444` (red) |
| Surface | `#0B1117` |
| Border | `#1F2937` |

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
         Fallback to mock_data.json  ← currently always reached
```

---

## Glossary

| Term | Meaning |
|------|---------| 
| **HS Code** | Harmonized System commodity classification (e.g., HS 85 = Semiconductors) |
| **FOB Value** | Free On Board — export value at point of departure |
| **MRDS** | Mineral Resources Data System (USGS) |
| **WFS** | Web Feature Service — OGC standard for geospatial data |
| **EAR** | Export Administration Regulations (US BIS) |
| **ITAR** | International Traffic in Arms Regulations |
| **OFAC** | Office of Foreign Assets Control (US Treasury) |
| **REE** | Rare Earth Elements |
