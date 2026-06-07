"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface RiskChartProps {
  commodities: { component: string; riskScore: number }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const v = payload[0].value;
    const color = v >= 75 ? "#ef4444" : v >= 50 ? "#fb923c" : "#4ade80";
    return (
      <div
        style={{
          background: "rgba(11,17,23,0.97)",
          border: "1px solid #1F2937",
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 11,
          color: "#f9fafb",
        }}
      >
        <div style={{ color: "#9ca3af", marginBottom: 3 }}>{payload[0].name}</div>
        <div style={{ color, fontWeight: 700, fontSize: 14 }}>{v.toFixed(1)} / 100</div>
      </div>
    );
  }
  return null;
};

export default function RiskChart({ commodities }: RiskChartProps) {
  if (!commodities || commodities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        No risk data available
      </div>
    );
  }

  const sorted = [...commodities].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="w-full h-full flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Avg Risk Score by Commodity
        </span>
        <span className="text-[9px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
          Threshold: 70
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 2, right: 30, left: 0, bottom: 2 }}
          barCategoryGap="30%"
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "#6b7280", fontSize: 9 }}
            axisLine={{ stroke: "#1F2937" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="component"
            tick={{ fill: "#9ca3af", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <ReferenceLine
            x={70}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{ value: "High Risk", position: "insideTopRight", fill: "#ef4444", fontSize: 9 }}
          />
          <Bar dataKey="riskScore" name="Risk Score" radius={[0, 3, 3, 0]}>
            {sorted.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.riskScore >= 75
                    ? "#ef4444"
                    : entry.riskScore >= 50
                    ? "#fb923c"
                    : "#4ade80"
                }
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
