"use client";

import { useMemo, useState } from "react";
import MapGL from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

const INITIAL_VIEW_STATE = {
  longitude: 20,
  latitude: 18,
  zoom: 1.6,
  pitch: 40,
  bearing: 0,
};

// Build unique country nodes with role tracking (Supplier / Customer / Both)
function buildNodes(dependencies: any[]) {
  const map = new Map<string, {
    country: string;
    coords: [number, number];
    restricted: number;
    total: number;
    isSupplier: boolean;
    isCustomer: boolean;
  }>();

  for (const d of dependencies) {
    const sk = d.source_country;
    const tk = d.target_country;
    if (!map.has(sk)) map.set(sk, { country: sk, coords: d.source_coords, restricted: 0, total: 0, isSupplier: false, isCustomer: false });
    if (!map.has(tk)) map.set(tk, { country: tk, coords: d.target_coords, restricted: 0, total: 0, isSupplier: false, isCustomer: false });
    const sn = map.get(sk)!;
    sn.total++;
    sn.isSupplier = true;
    if (d.restricted) sn.restricted++;
    const tn = map.get(tk)!;
    tn.total++;
    tn.isCustomer = true;
  }
  return Array.from(map.values()).map((n) => ({
    ...n,
    role: n.isSupplier && n.isCustomer ? "Supplier & Customer" : n.isSupplier ? "Supplier" : "Customer",
  }));
}

function buildTooltipHTML(object: any): string {
  const risk = object.riskScore ?? 0;
  const riskColor = risk >= 75 ? "#ef4444" : risk >= 50 ? "#fb923c" : "#4ade80";
  const restricted = object.restricted;
  const badgeColor = restricted ? "#ef4444" : "#38BDF8";
  const badgeBg = restricted ? "rgba(239,68,68,0.15)" : "rgba(56,189,248,0.12)";
  const badgeText = restricted ? "⚠ RESTRICTED" : "✓ OPEN FLOW";

  return `
    <div style="padding:14px 16px;min-width:230px;font-family:system-ui,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:13px;font-weight:700;color:#f9fafb;">${object.source_country} → ${object.target_country}</span>
        <span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:20px;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeColor}50;letter-spacing:0.05em;">${badgeText}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:#9ca3af;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>Component</span>
          <span style="color:#f9fafb;font-weight:600;">${object.component}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>Risk Score</span>
          <span style="color:${riskColor};font-weight:800;font-size:13px;">${risk}<span style="font-size:9px;font-weight:400;color:#6b7280;"> / 100</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>Risk Delta</span>
          <span style="color:#9ca3af;">${object.riskDelta ?? "—"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span>Risk Method</span>
          <span style="color:#6b7280;font-size:9px;">${object.dataSource?.includes("Comtrade") ? "Volume-proportional (FOB)" : "Commodity-calibrated (USGS)"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>Volume</span>
          <span style="color:#f9fafb;">${(object.volume ?? 0).toLocaleString()} MT</span>
        </div>
        ${object.restrictionReason ? `
        <div style="margin-top:4px;padding:7px 9px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;color:#fca5a5;font-size:10px;line-height:1.5;">
          ${object.restrictionReason}
        </div>` : ""}
        <div style="margin-top:4px;color:#4b5563;font-size:9px;border-top:1px solid #1F2937;padding-top:6px;">
          Source: ${object.dataSource ?? "Real Rails Synthetic"}
        </div>
      </div>
    </div>
  `;
}

function buildNodeTooltipHTML(node: any): string {
  const pct = node.total > 0 ? Math.round((node.restricted / node.total) * 100) : 0;
  const roleColor =
    node.role === "Supplier & Customer" ? "#818CF8" :
    node.role === "Supplier" ? "#38BDF8" : "#fb923c";
  const roleBg =
    node.role === "Supplier & Customer" ? "rgba(129,140,248,0.15)" :
    node.role === "Supplier" ? "rgba(56,189,248,0.15)" : "rgba(251,146,60,0.15)";

  return `
    <div style="padding:13px 15px;min-width:200px;font-family:system-ui,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">
        <span style="font-size:13px;font-weight:700;color:#38BDF8;">${node.country}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;background:${roleBg};color:${roleColor};border:1px solid ${roleColor}50;letter-spacing:0.04em;">
          ${node.role}
        </span>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:#9ca3af;">
        <div style="display:flex;justify-content:space-between;">
          <span>Total flows</span>
          <span style="color:#f9fafb;font-weight:600;">${node.total}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Restricted</span>
          <span style="color:#ef4444;font-weight:600;">${node.restricted} <span style="color:#6b7280;font-weight:400;">(${pct}%)</span></span>
        </div>
        <div style="margin-top:2px;font-size:9px;color:#4b5563;border-top:1px solid #1F2937;padding-top:5px;">
          Click to filter · hover arcs for detail
        </div>
      </div>
    </div>
  `;
}


interface Props {
  dependencies: any[];
  onNodeClick?: (country: string) => void;
}

export default function MapStage({ dependencies, onNodeClick }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodes = useMemo(() => buildNodes(dependencies), [dependencies]);

  // Compute overlay stats
  const totalVolume = useMemo(() => dependencies.reduce((s, d) => s + (d.volume ?? 0), 0), [dependencies]);
  const restrictedPct = useMemo(() => {
    if (!dependencies.length) return 0;
    return Math.round((dependencies.filter((d) => d.restricted).length / dependencies.length) * 100);
  }, [dependencies]);
  const avgRisk = useMemo(() => {
    if (!dependencies.length) return 0;
    return Math.round(dependencies.reduce((s, d) => s + (d.riskScore ?? 0), 0) / dependencies.length);
  }, [dependencies]);

  const layers = useMemo(() => [
    new ArcLayer({
      id: "dependency-arcs",
      data: dependencies,
      getSourcePosition: (d: any) => d.source_coords,
      getTargetPosition: (d: any) => d.target_coords,
      getSourceColor: (d: any) => d.restricted ? [239, 68, 68, 200] : [56, 189, 248, 200],
      getTargetColor: (d: any) => d.restricted ? [239, 68, 68, 80] : [129, 140, 248, 160],
      getWidth: (d: any) => Math.max(2, Math.min(10, Math.sqrt(d.volume ?? 1000) / 20)),
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 50],
    }),
    new ScatterplotLayer({
      id: "country-nodes",
      data: nodes,
      getPosition: (d: any) => d.coords,
      getRadius: (d: any) => (hoveredNode === d.country ? 220000 : 160000),
      getFillColor: (d: any) => {
        const pct = d.total > 0 ? d.restricted / d.total : 0;
        if (pct > 0.5) return [239, 68, 68, 220];
        if (pct > 0) return [251, 146, 60, 220];
        return [56, 189, 248, 220];
      },
      getLineColor: [11, 17, 23, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 80],
      onClick: ({ object }: any) => object && onNodeClick?.(object.country),
      onHover: ({ object }: any) => setHoveredNode(object?.country ?? null),
      updateTriggers: { getRadius: hoveredNode },
    }),
  ], [dependencies, nodes, hoveredNode, onNodeClick]);

  return (
    <div className="w-full h-full relative" style={{ background: "#030712" }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        getTooltip={({ object, layer }: any) => {
          if (!object) return null;
          const html = layer?.id === "country-nodes"
            ? buildNodeTooltipHTML(object)
            : buildTooltipHTML(object);
          return {
            html,
            style: {
              background: "rgba(11,17,23,0.97)",
              border: "1px solid #1F2937",
              borderRadius: "8px",
              padding: "0",
              boxShadow: "0 0 24px rgba(56,189,248,0.2)",
              color: "#f9fafb",
              pointerEvents: "none",
            },
          };
        }}
      >
        <MapGL mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
      </DeckGL>

      {/* ── Top-left overlay stats (matching Lovable reference) ── */}
      <div className="pointer-events-none absolute left-4 top-4 flex gap-3">
        <div
          className="pointer-events-auto rounded-md border px-3 py-2"
          style={{ background: "rgba(11,17,23,0.85)", backdropFilter: "blur(8px)", borderColor: "rgba(56,189,248,0.5)", boxShadow: "0 0 12px rgba(56,189,248,0.2)" }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Restricted flow</div>
          <div className="text-sm font-semibold text-primary">{restrictedPct}%</div>
        </div>
        <div
          className="pointer-events-auto rounded-md border border-border px-3 py-2"
          style={{ background: "rgba(11,17,23,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Tracked volume</div>
          <div className="text-sm font-semibold text-foreground">${(totalVolume / 1000).toFixed(1)}B</div>
        </div>
        <div
          className="pointer-events-auto rounded-md border border-border px-3 py-2"
          style={{ background: "rgba(11,17,23,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Avg risk</div>
          <div className="text-sm font-semibold text-foreground">{avgRisk}/100</div>
        </div>
        {/* VAR 1.3 — Temporal period indicator */}
        <div
          className="pointer-events-auto rounded-md border border-border px-3 py-2"
          style={{ background: "rgba(11,17,23,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Period</div>
          <div className="text-sm font-semibold text-foreground">2023–24</div>
        </div>
      </div>

      {/* ── Bottom-left legend ── */}
      <div
        className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border px-3 py-2 text-[10px] text-muted-foreground"
        style={{ background: "rgba(11,17,23,0.85)", backdropFilter: "blur(8px)" }}
      >
        <div className="mb-1.5 uppercase tracking-[0.15em] text-[9px]">Legend</div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "#F87171" }} />
            High risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Med risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary" />
            Low risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-primary" />
            Restricted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-secondary opacity-60" />
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
