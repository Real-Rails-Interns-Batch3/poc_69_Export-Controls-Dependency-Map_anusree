"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import IntelligenceSidebar from "./IntelligenceSidebar";

const MapStage = dynamic(() => import("./MapStage"), { ssr: false });

const API = "http://localhost:8000";

export interface KPIs {
  totalLinks: number;
  restrictedCount: number;
  restrictedPercent: number;
  topRiskCommodity: string;
  topRiskScore: number;
  alertLevel: string;
  dataAsOf: string;
  sources?: {
    comtrade_records: number;
    usgs_records: number;
  };
}

export interface AppData {
  dependencies: any[];
  insights: { whyThisMatters: string; whoControls: string };
  countryCompare: any[];
  commodities: any[];
  mitigations: any[];
  kpis: KPIs;
  sourceLabels: any[];
}

const FALLBACK: AppData = {
  dependencies: [],
  insights: { whyThisMatters: "", whoControls: "" },
  countryCompare: [],
  commodities: [],
  mitigations: [],
  kpis: { totalLinks: 0, restrictedCount: 0, restrictedPercent: 0, topRiskCommodity: "—", topRiskScore: 0, alertLevel: "—", dataAsOf: "—" },
  sourceLabels: [],
};

async function safeFetch(url: string, fallback: any = []) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    console.warn(`[2-Hour Rule] API failed for ${url}. Using fallback.`);
    return fallback;
  }
}

export default function Dashboard() {
  const [data, setData] = useState<AppData>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]); // multi-select
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      // Step 1 — fetch dependencies first (this call populates _source_status on the backend).
      // source-labels must NOT run in parallel: it reads _source_status which starts as "unknown"
      // and would always show "Mock Fallback" if fetched before the live API calls complete.
      const [dependencies, insights, countryCompare, commodities, mitigations, kpis] =
        await Promise.all([
          safeFetch(`${API}/api/dependencies`, []),
          safeFetch(`${API}/api/insights`, {}),
          safeFetch(`${API}/api/country-compare`, []),
          safeFetch(`${API}/api/risk-scores`, []),
          safeFetch(`${API}/api/mitigations`, []),
          safeFetch(`${API}/api/stats`, {}),
        ]);

      // Step 2 — now that _source_status is set (live or mock), fetch source-labels accurately.
      const sourceLabels = await safeFetch(`${API}/api/source-labels`, []);

      setData({ dependencies, insights, countryCompare, commodities, mitigations, kpis, sourceLabels });
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Filter dependencies: component multi-select + country click
  const filteredDependencies = data.dependencies.filter((d: any) => {
    const compOk = activeFilters.length === 0 || activeFilters.includes(d.component);
    const countryOk = !selectedCountry || d.source_country === selectedCountry || d.target_country === selectedCountry;
    return compOk && countryOk;
  });

  const handleNodeClick = (country: string) => {
    setSelectedCountry((prev) => (prev === country ? null : country));
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main Stage — 70% */}
      <div className="relative flex-none" style={{ width: "70%", height: "100%" }}>
        <MapStage dependencies={filteredDependencies} onNodeClick={handleNodeClick} />
        {selectedCountry && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setSelectedCountry(null)}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
              style={{ background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.4)", color: "#38BDF8" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filtering: {selectedCountry}
            </button>
          </div>
        )}
      </div>

      {/* Intelligence Sidebar — exactly 30% */}
      <aside
        className="flex-none overflow-hidden"
        style={{ width: "30%", height: "100%", borderLeft: "1px solid #1F2937", background: "rgba(11,17,23,0.6)" }}
      >
        <IntelligenceSidebar
          data={data}
          loading={loading}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
        />
      </aside>
    </div>
  );
}
