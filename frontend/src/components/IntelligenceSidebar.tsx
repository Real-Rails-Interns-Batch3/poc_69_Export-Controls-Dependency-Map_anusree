"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AppData } from "./Dashboard";

const RiskChart = dynamic(() => import("./RiskChart"), { ssr: false });

// ── Utilities ──────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
  HIGH:     { bg: "rgba(251,146,60,0.12)", text: "#fb923c", border: "rgba(251,146,60,0.3)" },
  MEDIUM:   { bg: "rgba(129,140,248,0.12)", text: "#818CF8", border: "rgba(129,140,248,0.3)" },
  LOW:      { bg: "rgba(74,222,128,0.12)", text: "#4ade80", border: "rgba(74,222,128,0.3)" },
};

const ALERT_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#fb923c", MEDIUM: "#818CF8", LOW: "#4ade80", "—": "#6b7280",
};

function SeverityBadge({ level }: { level: string }) {
  const c = SEVERITY_COLORS[level] ?? SEVERITY_COLORS.LOW;
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-none"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {level}
    </span>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#1F2937" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono font-semibold" style={{ color, minWidth: 24, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1" style={{ background: "#1F2937" }} />
      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap px-1">
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: "#1F2937" }} />
    </div>
  );
}

function GlassCard({ children, glowColor }: { children: React.ReactNode; glowColor?: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "rgba(11,17,23,0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid #1F2937",
        boxShadow: glowColor ? `0 0 14px ${glowColor}18` : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────
interface Props {
  data: AppData;
  loading: boolean;
  activeFilters: string[];
  setActiveFilters: (v: string[]) => void;
  selectedCountry: string | null;
  setSelectedCountry: (v: string | null) => void;
}

export default function IntelligenceSidebar({
  data, loading, activeFilters, setActiveFilters,
}: Props) {
  const [showChart, setShowChart] = useState(true);

  const downloadSampleData = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export_controls_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "#38BDF8", borderRightColor: "#818CF8" }} />
        <span className="text-xs text-muted-foreground">Ingesting intelligence feeds…</span>
      </div>
    );
  }

  const { insights, countryCompare, commodities, mitigations, kpis, dependencies } = data;
  const alertColor = ALERT_COLORS[kpis?.alertLevel] ?? "#6b7280";
  const allComponents = commodities.map((c: any) => c.component);

  const toggleFilter = (comp: string) => {
    setActiveFilters(
      activeFilters.includes(comp)
        ? activeFilters.filter((f) => f !== comp)
        : [...activeFilters, comp]
    );
  };

  // Flow count per component
  const flowCounts: Record<string, number> = {};
  for (const d of (dependencies ?? [])) {
    flowCounts[d.component] = (flowCounts[d.component] ?? 0) + 1;
  }

  return (
    <div
      className="h-full flex flex-col gap-0 overflow-y-auto overflow-x-hidden"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#1F2937 transparent" }}
    >

      {/* ─── SECTION A: Title + KPI Metrics ──────────────────── */}
      <div className="flex-none p-5 pb-4" style={{ borderBottom: "1px solid #1F2937" }}>
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground leading-tight">
              Export Controls<br />
              <span style={{ color: "#38BDF8" }}>Dependency Map</span>
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">Real Rails Intelligence</p>
          </div>
          <div
            className="flex-none flex flex-col items-center px-2.5 py-1.5 rounded-lg text-center"
            style={{ background: `${alertColor}14`, border: `1px solid ${alertColor}40` }}
          >
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Alert</span>
            <span className="text-sm font-black" style={{ color: alertColor }}>{kpis?.alertLevel}</span>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg p-2.5 flex flex-col gap-0.5"
            style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)" }}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Links</span>
            <span className="text-xl font-black" style={{ color: "#38BDF8" }}>{kpis?.totalLinks}</span>
          </div>
          <div className="rounded-lg p-2.5 flex flex-col gap-0.5"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Restricted</span>
            <span className="text-xl font-black text-destructive">{kpis?.restrictedPercent}%</span>
          </div>
          <div className="rounded-lg p-2.5 flex flex-col gap-0.5"
            style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Top Risk</span>
            <span className="text-xl font-black" style={{ color: "#818CF8" }}>{kpis?.topRiskScore}</span>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground mt-2.5 font-mono">{kpis?.dataAsOf}</p>
        {/* Live / Mock status badges */}
        {kpis?.sources && (
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <span
              className="text-[8px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1"
              style={{
                background: (kpis.sources as any).comtrade_live ? "rgba(56,189,248,0.08)" : "rgba(107,114,128,0.08)",
                color: (kpis.sources as any).comtrade_live ? "#38BDF8" : "#6b7280",
                border: `1px solid ${ (kpis.sources as any).comtrade_live ? "rgba(56,189,248,0.2)" : "rgba(107,114,128,0.2)" }`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: (kpis.sources as any).comtrade_live ? "#38BDF8" : "#6b7280", display: "inline-block" }} />
              Comtrade: {(kpis.sources as any).comtrade_records ?? 0}r {(kpis.sources as any).comtrade_live ? "● Live" : "◌ Mock"}
            </span>
            <span
              className="text-[8px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1"
              style={{
                background: (kpis.sources as any).usgs_live ? "rgba(129,140,248,0.08)" : "rgba(107,114,128,0.08)",
                color: (kpis.sources as any).usgs_live ? "#818CF8" : "#6b7280",
                border: `1px solid ${ (kpis.sources as any).usgs_live ? "rgba(129,140,248,0.2)" : "rgba(107,114,128,0.2)" }`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: (kpis.sources as any).usgs_live ? "#818CF8" : "#6b7280", display: "inline-block" }} />
              USGS: {(kpis.sources as any).usgs_records ?? 0}r {(kpis.sources as any).usgs_live ? "● Live" : "◌ Mock"}
            </span>
          </div>
        )}
      </div>

      {/* ─── SECTION B: Why This Matters ─────────────────────── */}
      <div className="flex-none p-5 pb-4" style={{ borderBottom: "1px solid #1F2937" }}>
        <Divider label="Why This Matters" />
        <GlassCard glowColor="#38BDF8">
          <p className="text-[11px] text-muted-foreground leading-relaxed">{insights?.whyThisMatters}</p>
        </GlassCard>
      </div>

      {/* ─── SECTION C: Who Controls the Rail ────────────────── */}
      <div className="flex-none p-5 pb-4" style={{ borderBottom: "1px solid #1F2937" }}>
        <Divider label="Who Controls the Rail" />
        <GlassCard glowColor="#818CF8">
          <p className="text-[11px] text-muted-foreground leading-relaxed">{insights?.whoControls}</p>
        </GlassCard>

        {/* Country Compare bars */}
        <div className="mt-3 flex flex-col gap-3">
          {countryCompare?.map((row: any) => (
            <div key={row.country} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">{row.country}</span>
                <span className="text-[9px] text-muted-foreground">{row.primaryExport}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Dominance</span>
                  <MiniBar value={row.exportDominance} color="#38BDF8" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Vulnerability</span>
                  <MiniBar value={row.vulnerability} color="#ef4444" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── SECTION D: Filters + Risk Chart + Mitigations ───── */}
      <div className="flex-none p-5 pb-4" style={{ borderBottom: "1px solid #1F2937" }}>

        {/* Component filter pills */}
        <Divider label="Component Filter" />
        <div className="flex flex-wrap gap-1.5 mt-1">
          {["All", ...allComponents].map((comp) => {
            const isActive = comp === "All" ? activeFilters.length === 0 : activeFilters.includes(comp);
            const flows = comp !== "All" ? flowCounts[comp] ?? 0 : null;
            return (
              <button
                key={comp}
                onClick={() => comp === "All" ? setActiveFilters([]) : toggleFilter(comp)}
                className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-all duration-200 flex items-center gap-1"
                style={{
                  background: isActive ? "rgba(56,189,248,0.2)" : "rgba(31,41,55,0.6)",
                  color: isActive ? "#38BDF8" : "#9ca3af",
                  border: isActive ? "1px solid rgba(56,189,248,0.5)" : "1px solid #1F2937",
                  boxShadow: isActive ? "0 0 8px rgba(56,189,248,0.2)" : "none",
                }}
              >
                {comp}
                {flows !== null && (
                  <span className="text-[8px] opacity-70">{flows}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Risk chart */}
        <div className="mt-4">
          <button
            onClick={() => setShowChart((s) => !s)}
            className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center" style={{ fontSize: 8 }}>
              {showChart ? "−" : "+"}
            </span>
            Risk Score Distribution
          </button>
          {showChart && (() => {
            const filteredComps = activeFilters.length === 0
              ? commodities
              : commodities.filter((c: any) => activeFilters.includes(c.component));
            return <div style={{ height: 200 }}><RiskChart commodities={filteredComps} /></div>;
          })()}
        </div>

        {/* Mitigation Pathways */}
        <div className="mt-4">
          <Divider label="Mitigation Pathways" />
          <div className="flex flex-col gap-2.5 mt-1">
            {mitigations?.map((m: any, idx: number) => (
              <div
                key={idx}
                className="rounded-lg p-3 flex flex-col gap-1.5"
                style={{ background: "rgba(11,17,23,0.7)", border: "1px solid #1F2937" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{m.title}</span>
                  <SeverityBadge level={m.severity ?? "LOW"} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</p>
                <span className="text-[9px] font-mono text-muted-foreground">Horizon: {m.timeframe}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECTION E: Source Status + Download ──────────────── */}
      <div className="flex-none p-5">

        {/* Data source status cards */}
        {data.sourceLabels?.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 py-1 mb-2">
              <div className="h-px flex-1" style={{ background: "#1F2937" }} />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap px-1">Data Sources</span>
              <div className="h-px flex-1" style={{ background: "#1F2937" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              {data.sourceLabels.map((src: any) => (
                <div
                  key={src.id}
                  className="flex items-center justify-between rounded-md px-2.5 py-2"
                  style={{
                    background: "rgba(11,17,23,0.7)",
                    border: `1px solid ${src.live ? src.color + "40" : "#1F2937"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: src.live ? src.color : "#374151", display: "inline-block", flexShrink: 0 }} />
                    <span className="text-[10px] font-semibold" style={{ color: src.live ? src.color : "#6b7280" }}>{src.name}</span>
                  </div>
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: src.live ? `${src.color}18` : "rgba(107,114,128,0.12)",
                      color: src.live ? src.color : "#6b7280",
                      border: `1px solid ${src.live ? src.color + "40" : "rgba(107,114,128,0.2)"}`,
                    }}
                  >
                    {src.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={downloadSampleData}
          className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
          style={{ background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.3)", color: "#38BDF8" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.14)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 15px rgba(56,189,248,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.07)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Data
          <span className="text-[10px] text-muted-foreground font-normal ml-1">(JSON)</span>
        </button>
        <p className="text-[9px] text-muted-foreground text-center mt-3 leading-relaxed">
          Sources: UN Comtrade API + USGS MRDS WFS.<br />
          Strategic insights are expert-curated content.
        </p>
      </div>
    </div>
  );
}
