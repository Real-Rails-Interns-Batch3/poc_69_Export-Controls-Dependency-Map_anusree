# Export Controls Dependency Map — Real Rails

> **Rail:** Governance & Trust | **Stack:** Next.js 15 + FastAPI + DeckGL + UN Comtrade + USGS MRDS

A geospatial intelligence dashboard that maps global export-control dependency networks across critical minerals and dual-use technologies. Trade flow data is ingested live from **UN Comtrade** and **USGS Mineral Resources Data System**.

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
│  │ Live Adapter    │    │ Live Adapter (WFS)   │        │
│  │ (Public API)    │    │ mrds-high layer      │        │
│  └────────┬────────┘    └──────────┬───────────┘        │
│           └──────────┬─────────────┘                    │
│              ┌───────▼──────┐                           │
│              │ In-Memory    │                           │
│              │ Cache 30min  │                           │
│              └───────┬──────┘                           │
│                      │  Fallback: mock_data.json        │
└──────────────────────┴──────────────────────────────────┘
```

---

## Data Sources

| Source | Type | Endpoint | Auth |
|--------|------|----------|------|
| **UN Comtrade** | Live | `comtradeapi.un.org/public/v1/preview/C/A/HS` | None (public) |
| **USGS MRDS** | Live (WFS) | `mrdata.usgs.gov/cgi-bin/mapserv` — `mrds-high` layer | None (public) |
| **Mock Data** | Fallback | `backend/mock_data.json` | N/A |

> No API keys required. The Comtrade public preview endpoint is limited to 500 records/request. For bulk pulls, register a free key at [comtradeplus.un.org](https://comtradeplus.un.org).

---

## Quick Start

### 1. Backend

```powershell
cd "Export Controls/backend"
pip install -r requirements.txt
python main.py
# → Runs on http://localhost:8000
```

### 2. Frontend

```powershell
cd "Export Controls/frontend"
npm install
npm run dev
# → Runs on http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dependencies` | All trade links (Comtrade + USGS merged) |
| `GET` | `/api/dependencies/comtrade` | UN Comtrade live trade flows only |
| `GET` | `/api/dependencies/usgs` | USGS MRDS mineral deposits only |
| `GET` | `/api/stats` | KPI metrics with live record counts |
| `GET` | `/api/risk-scores` | Avg risk score per commodity |
| `GET` | `/api/country-compare` | Export dominance & vulnerability scores |
| `GET` | `/api/mitigations` | Strategic mitigation pathways |
| `GET` | `/api/source-labels` | Data provenance metadata |
| `GET` | `/api/cache/status` | Cache age & freshness |
| `POST` | `/api/cache/invalidate` | Force-refresh live data |
| `GET` | `/health` | Health check |

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

## Project Structure

```
Export Controls/
├── backend/
│   ├── main.py              # FastAPI app + Comtrade & USGS adapters
│   ├── mock_data.json        # Fallback synthetic data
│   └── requirements.txt
├── frontend/
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
├── docs/
│   ├── VAR_Visualization_Audit_Report.md
│   └── UAT_Functional_Test_Document.md
└── README.md
```

---

## Caching Strategy

Live data is cached in-memory for **30 minutes** per source to avoid rate-limiting. Use `POST /api/cache/invalidate` to force a fresh pull.

```
Request → Cache hit? → Return cached data (fast)
               ↓ No
         Fetch UN Comtrade live
         Fetch USGS MRDS live
         Merge + store in cache
         Return data
               ↓ Any error
         Fallback to mock_data.json
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
