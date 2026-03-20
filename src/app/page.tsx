"use client";

import { useEffect, useMemo, useState } from "react";
import MapClient from "./map-client";

type EventItem = {
  id: string;
  title: string;
  category: string;
  source: string;
  sourceType: "api" | "rss";
  url?: string;
  time?: string;
  lat?: number;
  lon?: number;
  severity: number;
  importance: number;
};

type SourceStatus = {
  source: string;
  ok: boolean;
  count: number;
  note?: string;
};

export default function Home() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());
  const [count, setCount] = useState(0);
  const [mappedCount, setMappedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setSources(d.sources || []);
        setUpdatedAt(d.updatedAt || new Date().toISOString());
        setCount(d.count || 0);
        setMappedCount(d.mappedCount || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (sourceFilter === "ALL") return items;
    return items.filter((x) => x.source === sourceFilter);
  }, [items, sourceFilter]);

  const sourceNames = useMemo(() => ["ALL", ...Array.from(new Set(items.map((x) => x.source)))], [items]);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 20, fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 4 }}>World Event Map</h1>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Unified live events feed. Updated: {new Date(updatedAt).toLocaleString()} · total events: {count} · mapped events: {mappedCount}
        </p>

        {loading ? <p>Loading events...</p> : <MapClient items={items} />}

        <div
          style={{
            marginTop: 12,
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: 10,
            background: "#101010",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Map legend</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div>
              <div style={{ marginBottom: 6, opacity: 0.9 }}>Source → shape</div>
              <div>● USGS</div>
              <div>◆ EMSC</div>
              <div>▲ GDACS</div>
              <div>■ NASA EONET</div>
              <div>⬟ ReliefWeb</div>
              <div>★ GDELT</div>
            </div>
            <div>
              <div style={{ marginBottom: 6, opacity: 0.9 }}>Severity → color</div>
              <div><span style={{ color: "#52c41a" }}>●</span> Low (&lt; 40)</div>
              <div><span style={{ color: "#fadb14" }}>●</span> Moderate (40–59)</div>
              <div><span style={{ color: "#fa8c16" }}>●</span> High (60–79)</div>
              <div><span style={{ color: "#ff4d4f" }}>●</span> Critical (80+)</div>
            </div>
          </div>
        </div>

        <h3 style={{ marginTop: 20 }}>Source status</h3>
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {sources.map((s) => (
            <div key={s.source} style={{ fontSize: 13, opacity: 0.9 }}>
              {s.ok ? "✅" : "❌"} {s.source} · {s.count} items{s.note ? ` · ${s.note}` : ""}
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: 16 }}>All events (tabular)</h3>
        <div style={{ marginBottom: 10 }}>
          <label style={{ marginRight: 8 }}>Filter source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            {sourceNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #2a2a2a", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#121212", textAlign: "left" }}>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Time (UTC)</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Source</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Type</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Category</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Title</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Coords</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Severity</th>
                <th style={{ padding: 8, borderBottom: "1px solid #2a2a2a" }}>Importance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 1500).map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #1d1d1d" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{e.time ? new Date(e.time).toUTCString() : "n/a"}</td>
                  <td style={{ padding: 8 }}>{e.source}</td>
                  <td style={{ padding: 8 }}>{e.sourceType}</td>
                  <td style={{ padding: 8 }}>{e.category}</td>
                  <td style={{ padding: 8 }}>
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer" style={{ color: "#9ecbff" }}>
                        {e.title}
                      </a>
                    ) : (
                      e.title
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{e.lat != null && e.lon != null ? `${e.lat.toFixed(2)}, ${e.lon.toFixed(2)}` : "—"}</td>
                  <td style={{ padding: 8 }}>{e.severity.toFixed(1)}</td>
                  <td style={{ padding: 8 }}>{e.importance.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
