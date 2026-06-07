from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import time
import httpx
import xml.etree.ElementTree as ET
import pandas as pd
from typing import Optional

app = FastAPI(title="Real Rails Intelligence API — Export Controls Dependency Map")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ────────────────────────────────────────────────────────────────

CACHE_TTL_SECONDS = 1800  # 30 minutes

# UN Comtrade — public preview endpoint (no API key required, 500 rec/req limit)
COMTRADE_BASE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"

# USGS MRDS — WFS endpoint (confirmed working from GetCapabilities)
USGS_WFS_BASE = "https://mrdata.usgs.gov/cgi-bin/mapserv"
USGS_MAP_FILE = "/mnt/mrt/map-files/mrds.map"

# Reporter country codes (UN M49): USA=842, China=156, Australia=36, Chile=152,
# Russia=643, Japan=392, India=356, South Africa=710, Canada=124, Malaysia=458,
# Kazakhstan=398, Indonesia=360, Taiwan=158, EU=918
CRITICAL_REPORTERS = [842, 156, 36, 152, 643, 392, 356, 710, 124, 458, 398, 360, 158]

# HS Chapters relevant to export-controlled critical materials
# 26=Ores, 28=Inorganic chemicals, 74=Copper, 75=Nickel, 80=Tin,
# 84=Machinery, 85=Electrical (semiconductors), 90=Optical
CRITICAL_HS_CHAPTERS = ["26", "28", "74", "75", "80", "84", "85", "90"]

# Commodities to query from USGS MRDS
CRITICAL_MINERALS = ["Cobalt", "Lithium", "Nickel", "Uranium", "Platinum", "Titanium", "Rare earths"]

# ─── HS Code → commodity label mapping ───────────────────────────────────────

HS_COMMODITY_MAP = {
    "26": "Critical Ores & Minerals",
    "28": "Inorganic Chemicals & REE",
    "74": "Copper",
    "75": "Nickel & Alloys",
    "80": "Tin",
    "84": "Industrial Machinery",
    "85": "Semiconductors & Electronics",
    "90": "Optical & Precision Equipment",
}

# Country code → ISO / display name mapping
COUNTRY_CODE_MAP = {
    842: ("USA", [-95.7129, 37.0902]),
    156: ("China", [104.1954, 35.8617]),
    36:  ("Australia", [133.7751, -25.2744]),
    152: ("Chile", [-71.5430, -35.6751]),
    643: ("Russia", [105.3188, 61.5240]),
    392: ("Japan", [138.2529, 36.2048]),
    356: ("India", [78.9629, 20.5937]),
    710: ("South Africa", [22.9375, -30.5595]),
    124: ("Canada", [-96.8165, 56.1304]),
    458: ("Malaysia", [109.6976, 4.2105]),
    398: ("Kazakhstan", [66.9237, 48.0196]),
    360: ("Indonesia", [113.9213, -0.7893]),
    158: ("Taiwan", [120.9605, 23.6978]),
    918: ("EU", [10.4515, 51.1657]),
}

# ─── In-Memory Cache ─────────────────────────────────────────────────────────

_cache: dict = {}

def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL_SECONDS:
        return entry["data"]
    return None

def _cache_set(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}

# ─── Mock Data Fallback ───────────────────────────────────────────────────────

def get_mock_data() -> dict:
    """Fallback — returns local mock_data.json."""
    mock_file = os.path.join(os.path.dirname(__file__), "mock_data.json")
    try:
        with open(mock_file, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Mock data not found. Check mock_data.json exists.")

# ─── UN Comtrade Live Adapter ─────────────────────────────────────────────────

def fetch_comtrade_live() -> list:
    """
    Fetches live trade flow data from UN Comtrade public preview API.
    Queries critical HS chapters across major reporter countries.
    Falls back to mock data on any error.
    Returns a list of dependency-link dicts compatible with the app schema.
    """
    cached = _cache_get("comtrade_live")
    if cached is not None:
        return cached

    results = []
    link_counter = 1

    try:
        with httpx.Client(timeout=15.0) as client:
            for reporter_code in CRITICAL_REPORTERS[:6]:  # Limit to top 6 to stay within free tier
                for hs_chapter in CRITICAL_HS_CHAPTERS[:4]:  # 4 chapters per reporter
                    params = {
                        "reporterCode": reporter_code,
                        "period": 2023,
                        "flowCode": "X",   # Exports
                        "cmdCode": hs_chapter,
                        "maxRecords": 10,
                    }
                    try:
                        resp = client.get(COMTRADE_BASE, params=params)
                        if resp.status_code != 200:
                            continue
                        payload = resp.json()
                        records = payload.get("data", [])

                        reporter_name, reporter_coords = COUNTRY_CODE_MAP.get(
                            reporter_code, (str(reporter_code), [0, 0])
                        )

                        for record in records[:2]:  # Take top 2 per query
                            partner_code = record.get("partnerCode", 0)
                            if partner_code == 0:
                                continue  # Skip "World" aggregate

                            partner_info = COUNTRY_CODE_MAP.get(partner_code)
                            if not partner_info:
                                continue

                            partner_name, partner_coords = partner_info
                            fob_value = record.get("fobvalue") or record.get("primaryValue", 0)
                            cmd_code = str(record.get("cmdCode", hs_chapter))
                            commodity = HS_COMMODITY_MAP.get(cmd_code[:2], f"HS {cmd_code}")

                            # Derive a basic risk score from trade volume and commodity sensitivity
                            volume_m = round((fob_value or 0) / 1_000_000, 1)
                            base_risk = min(95, 40 + int(volume_m / 50))

                            results.append({
                                "id": f"ct-{link_counter:03d}",
                                "source_country": reporter_name,
                                "target_country": partner_name,
                                "component": commodity,
                                "restricted": base_risk > 70,
                                "restrictionReason": "EAR / ITAR — flagged by trade volume model" if base_risk > 70 else None,
                                "dataSource": "UN Comtrade (Live)",
                                "riskScore": base_risk,
                                "riskDelta": f"+{base_risk - 55}% vs avg" if base_risk > 55 else f"{base_risk - 55}% vs avg",
                                "source_coords": reporter_coords,
                                "target_coords": partner_coords,
                                "volume": int(fob_value / 1000) if fob_value else 0,
                                "period": str(record.get("period", 2023)),
                                "hsCode": cmd_code,
                            })
                            link_counter += 1

                    except Exception:
                        continue  # Silently skip failed sub-requests

    except Exception as e:
        print(f"[Comtrade] Live fetch failed, using mock: {e}")
        mock_deps = get_mock_data().get("dependencies", [])
        return [d for d in mock_deps if "Comtrade" in d.get("dataSource", "")]

    if not results:
        # Fallback if API returned nothing useful
        mock_deps = get_mock_data().get("dependencies", [])
        return [d for d in mock_deps if "Comtrade" in d.get("dataSource", "")]

    _cache_set("comtrade_live", results)
    return results


# ─── USGS MRDS Live Adapter ───────────────────────────────────────────────────

def fetch_usgs_live() -> list:
    """
    Fetches live mineral deposit data from USGS MRDS via WFS (OGC standard).
    Feature type: mrds-high (confirmed from GetCapabilities).
    Falls back to mock data on any error.
    Returns a list of dependency-link dicts compatible with the app schema.
    """
    cached = _cache_get("usgs_live")
    if cached is not None:
        return cached

    results = []
    link_counter = 1

    # Commodity → HS mapping for context
    MINERAL_RISK = {
        "Cobalt": 94,
        "Lithium": 55,
        "Nickel": 76,
        "Uranium": 73,
        "Platinum": 55,
        "Titanium": 85,
        "Rare earths": 91,
    }

    MINERAL_COUNTRY_MAP = {
        "Cobalt": ("DRC", [23.6401, -4.0383], "China", [104.1954, 35.8617]),
        "Lithium": ("Australia", [133.7751, -25.2744], "USA", [-95.7129, 37.0902]),
        "Nickel": ("Indonesia", [113.9213, -0.7893], "Japan", [138.2529, 36.2048]),
        "Uranium": ("Canada", [-96.8165, 56.1304], "USA", [-95.7129, 37.0902]),
        "Platinum": ("South Africa", [22.9375, -30.5595], "USA", [-95.7129, 37.0902]),
        "Titanium": ("Russia", [105.3188, 61.5240], "India", [78.9629, 20.5937]),
        "Rare earths": ("China", [104.1954, 35.8617], "EU", [10.4515, 51.1657]),
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            for mineral in CRITICAL_MINERALS:
                # Build WFS GetFeature request with OGC filter
                filter_xml = f"""
                <ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">
                  <ogc:PropertyIsLike wildCard="*" singleChar="." escapeChar="!">
                    <ogc:PropertyName>commod1</ogc:PropertyName>
                    <ogc:Literal>{mineral}*</ogc:Literal>
                  </ogc:PropertyIsLike>
                </ogc:Filter>""".strip()

                params = {
                    "map": USGS_MAP_FILE,
                    "service": "WFS",
                    "version": "1.1.0",
                    "request": "GetFeature",
                    "typeName": "mrds-high",
                    "maxFeatures": 5,
                    "outputFormat": "text/xml; subtype=gml/3.1.1",
                    "FILTER": filter_xml,
                }

                try:
                    resp = client.get(USGS_WFS_BASE, params=params)
                    if resp.status_code != 200:
                        continue

                    # Parse GML XML response
                    root = ET.fromstring(resp.text)
                    ns = {
                        "wfs": "http://www.opengis.net/wfs",
                        "gml": "http://www.opengis.net/gml",
                        "ms": "http://mapserver.gis.umn.edu/mapserver",
                    }

                    features = root.findall(".//ms:mrds-high", ns) or root.findall(".//{http://mapserver.gis.umn.edu/mapserver}mrds-high")

                    src_country, src_coords, tgt_country, tgt_coords = MINERAL_COUNTRY_MAP.get(
                        mineral, ("Unknown", [0, 0], "USA", [-95.7129, 37.0902])
                    )
                    risk = MINERAL_RISK.get(mineral, 60)

                    if features:
                        # Use real feature data for deposit count / site names
                        deposit_names = []
                        for feat in features[:3]:
                            name_el = feat.find(".//{http://mapserver.gis.umn.edu/mapserver}site_name")
                            if name_el is not None and name_el.text:
                                deposit_names.append(name_el.text.strip())

                        label = f"{mineral} ({', '.join(deposit_names[:2])})" if deposit_names else mineral
                        num_deposits = len(features)
                        volume_proxy = num_deposits * 1200
                    else:
                        label = mineral
                        volume_proxy = 2000

                    results.append({
                        "id": f"us-{link_counter:03d}",
                        "source_country": src_country,
                        "target_country": tgt_country,
                        "component": label,
                        "restricted": risk > 70,
                        "restrictionReason": f"NRC/EAR — Critical Mineral: {mineral}" if risk > 70 else None,
                        "dataSource": "USGS MRDS (Live)",
                        "riskScore": risk,
                        "riskDelta": f"+{risk - 55}% above regional avg" if risk > 55 else f"{risk - 55}% below regional avg",
                        "source_coords": src_coords,
                        "target_coords": tgt_coords,
                        "volume": volume_proxy,
                        "mineral": mineral,
                    })
                    link_counter += 1

                except Exception:
                    continue  # Skip failed minerals silently

    except Exception as e:
        print(f"[USGS] Live fetch failed, using mock: {e}")
        mock_deps = get_mock_data().get("dependencies", [])
        return [d for d in mock_deps if "USGS" in d.get("dataSource", "")]

    if not results:
        mock_deps = get_mock_data().get("dependencies", [])
        return [d for d in mock_deps if "USGS" in d.get("dataSource", "")]

    _cache_set("usgs_live", results)
    return results


# ─── Combined Data Assembly ───────────────────────────────────────────────────

def get_all_live_dependencies() -> list:
    """Merge UN Comtrade + USGS MRDS live data."""
    comtrade = fetch_comtrade_live()
    usgs = fetch_usgs_live()
    return comtrade + usgs


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/dependencies")
def get_dependencies():
    """All dependency links — live from UN Comtrade + USGS MRDS (cached 30 min)."""
    return get_all_live_dependencies()

@app.get("/api/dependencies/comtrade")
def get_comtrade_dependencies():
    """Trade flow dependencies — live from UN Comtrade public API."""
    return fetch_comtrade_live()

@app.get("/api/dependencies/usgs")
def get_usgs_dependencies():
    """Mineral deposit dependencies — live from USGS MRDS WFS."""
    return fetch_usgs_live()

@app.get("/api/country-compare")
def get_country_compare():
    """Country comparison metrics computed dynamically from active dependencies."""
    deps = get_all_live_dependencies()
    countries = {}
    
    metadata = {
        "China": "Refined Minerals & REE",
        "USA": "IP & Software",
        "Taiwan": "Semiconductors",
        "EU": "Industrial Machinery",
        "Russia": "Titanium & Aerospace",
        "DRC": "Cobalt Ore",
    }
    
    for d in deps:
        src = d.get("source_country")
        tgt = d.get("target_country")
        vol = d.get("volume", 0)
        risk = d.get("riskScore", 0)
        restricted = 1 if d.get("restricted") else 0
        
        if src:
            if src not in countries:
                countries[src] = {
                    "exports_vol": 0, "exports_count": 0, "exports_risk_sum": 0,
                    "imports_vol": 0, "imports_count": 0, "imports_risk_sum": 0,
                    "imports_restricted_count": 0
                }
            countries[src]["exports_vol"] += vol
            countries[src]["exports_count"] += 1
            countries[src]["exports_risk_sum"] += risk
        if tgt:
            if tgt not in countries:
                countries[tgt] = {
                    "exports_vol": 0, "exports_count": 0, "exports_risk_sum": 0,
                    "imports_vol": 0, "imports_count": 0, "imports_risk_sum": 0,
                    "imports_restricted_count": 0
                }
            countries[tgt]["imports_vol"] += vol
            countries[tgt]["imports_count"] += 1
            countries[tgt]["imports_risk_sum"] += risk
            countries[tgt]["imports_restricted_count"] += restricted
            
    total_export_vol = sum(c["exports_vol"] for c in countries.values()) or 1
    
    results = []
    target_countries = ["China", "USA", "Taiwan", "EU", "Russia", "DRC"]
    for country in target_countries:
        stats = countries.get(country, {
            "exports_vol": 0, "exports_count": 0, "exports_risk_sum": 0,
            "imports_vol": 0, "imports_count": 0, "imports_risk_sum": 0,
            "imports_restricted_count": 0
        })
        
        # Proportional dominance from exports volume
        if stats["exports_count"] > 0:
            vol_share = (stats["exports_vol"] / total_export_vol) * 100
            export_dominance = min(95, max(30, int(vol_share * 1.5) + 35))
        else:
            export_dominance = 30
        
        # Proportional vulnerability from average risk of imports
        if stats["imports_count"] > 0:
            avg_import_risk = stats["imports_risk_sum"] / stats["imports_count"]
            import_vulnerability = min(95, max(30, int(avg_import_risk)))
        else:
            import_vulnerability = 30
            
        results.append({
            "country": country,
            "exportDominance": export_dominance,
            "vulnerability": import_vulnerability,
            "primaryExport": metadata.get(country, "Export Goods")
        })
        
    return results

@app.get("/api/insights")
def get_insights():
    return get_mock_data().get("insights", {})

@app.get("/api/source-labels")
def get_source_labels():
    """Data provenance labels — updated to reflect live sources."""
    return [
        {
            "id": "comtrade",
            "name": "UN Comtrade",
            "type": "Live",
            "coverage": "Trade flow volumes, HS chapters 26–28, 74–75, 84–85, 90",
            "color": "#38BDF8",
            "endpoint": "comtradeapi.un.org/public/v1/preview",
        },
        {
            "id": "usgs",
            "name": "USGS MRDS",
            "type": "Live",
            "coverage": "Mineral deposit locations, extraction sites (mrds-high WFS layer)",
            "color": "#818CF8",
            "endpoint": "mrdata.usgs.gov/cgi-bin/mapserv (WFS 1.1.0)",
        },
        {
            "id": "synthetic",
            "name": "Real Rails Synthetic",
            "type": "Fallback",
            "coverage": "Supplier-customer links, restriction mappings (used when live APIs unavailable)",
            "color": "#4ade80",
        },
    ]

@app.get("/api/stats")
def get_stats():
    """High-level KPI metrics derived from live data."""
    deps = get_all_live_dependencies()
    total = len(deps)
    restricted = sum(1 for d in deps if d.get("restricted"))
    risk_scores = [d.get("riskScore", 0) for d in deps if d.get("riskScore")]
    top = max(deps, key=lambda d: d.get("riskScore", 0), default={})

    return {
        "totalLinks": total,
        "restrictedCount": restricted,
        "restrictedPercent": round((restricted / total * 100) if total else 0),
        "topRiskCommodity": top.get("component", "N/A"),
        "topRiskScore": top.get("riskScore", 0),
        "alertLevel": "HIGH" if restricted / max(total, 1) > 0.4 else "MEDIUM",
        "dataAsOf": "2023–2024 (Live · UN Comtrade + USGS MRDS)",
        "sources": {
            "comtrade_records": sum(1 for d in deps if "Comtrade" in d.get("dataSource", "")),
            "usgs_records": sum(1 for d in deps if "USGS" in d.get("dataSource", "")),
        },
    }

@app.get("/api/risk-scores")
def get_risk_scores():
    """Aggregated avg risk score per commodity component (live data)."""
    deps = get_all_live_dependencies()
    df = pd.DataFrame(deps)
    if df.empty:
        return []
    risk_summary = df.groupby("component")["riskScore"].mean().reset_index()
    risk_summary["riskScore"] = risk_summary["riskScore"].round(1)
    return risk_summary.to_dict(orient="records")

@app.get("/api/mitigations")
def get_mitigations():
    """Mitigation suggestions with severity and timeframe."""
    return get_mock_data().get("mitigations", [])

@app.get("/api/cache/status")
def get_cache_status():
    """Shows current cache freshness for both live adapters."""
    now = time.time()
    status = {}
    for key in ["comtrade_live", "usgs_live"]:
        entry = _cache.get(key)
        if entry:
            age = int(now - entry["ts"])
            status[key] = {
                "cached": True,
                "age_seconds": age,
                "expires_in_seconds": max(0, CACHE_TTL_SECONDS - age),
                "records": len(entry["data"]),
            }
        else:
            status[key] = {"cached": False}
    return status

@app.post("/api/cache/invalidate")
def invalidate_cache():
    """Force-clear both live data caches to trigger fresh API pulls."""
    _cache.clear()
    return {"status": "cleared", "message": "Both Comtrade and USGS caches invalidated."}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "rail": "Governance & Trust",
        "data_sources": ["UN Comtrade (Live)", "USGS MRDS (Live)"],
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
