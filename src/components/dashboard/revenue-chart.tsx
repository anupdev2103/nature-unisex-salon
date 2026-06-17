"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatINR } from "@/lib/money";

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    revenue: d.revenue / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142 71% 29%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142 71% 29%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          width={48}
        />
        <Tooltip
          formatter={(v: number) => [formatINR(v * 100), "Revenue"]}
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(240 5.9% 90%)" }}
        />
        <Area type="monotone" dataKey="revenue" stroke="hsl(142 71% 29%)" strokeWidth={2} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
