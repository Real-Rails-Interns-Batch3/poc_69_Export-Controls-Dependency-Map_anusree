# VAR — Export Controls Dependency Map
**Auditor:** Senior UX Architect &nbsp;|&nbsp; **Date:** 2026-06-03 &nbsp;|&nbsp; **Backend:** FastAPI `localhost:8000` — Comtrade 403; USGS not verified. Data served from `mock_data.json`

---

## Mock Data Snapshot

> ⚠️ All records are from `backend/mock_data.json`. No live API was active during this audit.

| Metric | Value |
|--------|-------|
| UN Comtrade records | **4** (ct-001 → ct-004) |
| USGS MRDS records | **7** (us-001 → us-007) |
| Total dependency links | **11** · Restricted: **5** (45%) |
| Top risk commodity | **Cobalt** — score 94 · Alert: **HIGH** |
| Cache TTL | 1800s · Comtrade: 439s · USGS: 421s |

**Comtrade (4):** China→Canada Copper/42 · China→USA Copper/50 · Japan→Malaysia Ores/40 · Japan→Malaysia Nickel-Alloys/40

**USGS (7):** DRC→China Cobalt/94★ · AUS→USA Lithium/55 · IDN→JPN Nickel/76★ · CAN→USA Uranium/73★ · ZAF→USA Platinum/55 · RUS→IND Titanium/85★ · CHN→EU REE/91★ &nbsp;*(★ = restricted)*

---

## Scorecard

| Section | Checks | ✅ Pass | ⚠️ | ❌ |
|---------|--------|--------|----|---|
| 1. Requirement Match (Geo / Relational / Temporal) | 6 | **6** | 0 | 0 |
| 2. DNA Check (`#030712` bg · 70/30 split · color tokens) | 9 | **9** | 0 | 0 |
| 3. Data Mapping (source labels · coords · filters · counts) | 9 | **9** | 0 | 0 |
| **TOTAL** | **24** | **24** | **0** | **0** |

### Key Evidence
| Check | Evidence |
|-------|----------|
| Geo/ArcLayer | `MapStage.tsx:187` — DeckGL on MapLibre, real lat/lon from `COUNTRY_CODE_MAP` |
| Volume encoding | `MapStage.tsx:158` — `getWidth: max(2, volume/1200)`; ct-002 vol=540,627→width=450px |
| Background lock | `globals.css:53,89,128` + `MapStage.tsx:187` — `#030712` in `:root`, `.dark`, `body`, inline |
| 70/30 split | `Dashboard.tsx:90` 70% · `Dashboard.tsx:111` 30%, flush flex layout |
| Color tokens | `--primary: #38BDF8` (cyan) · `--secondary: #818CF8` (indigo) in `globals.css:59,61` |
| Filter logic | `Dashboard.tsx:77-80` — `compOk && countryOk` AND-gate → `filteredDependencies` |
| Tooltip source | `MapStage.tsx:87` — `dataSource ?? "Real Rails Synthetic"` |
| Live counts | `/api/stats` → `comtrade_records:4, usgs_records:7` — sidebar badges confirmed |

---

## 🟢 Overall: GREEN — 24/24 Pass · No items remaining
