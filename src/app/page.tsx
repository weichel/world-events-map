"use client";

import { useEffect, useState } from "react";
import MapClient from "./map-client";

type EventItem = {
  id: string;
  title: string;
  category: string;
  source: string;
  url?: string;
  time?: string;
  lat: number;
  lon: number;
  severity: number;
  importance: number;
};

export default function Home() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setUpdatedAt(d.updatedAt || new Date().toISOString());
        setCount(d.count || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const top = items.slice(0, 20);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 20, fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 4 }}>World Event Map</h1>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Live global events with importance scoring. Updated: {new Date(updatedAt).toLocaleString()} · events: {count}
        </p>

        {loading ? <p>Loading events...</p> : <MapClient items={items} />}

        <h3 style={{ marginTop: 20 }}>Top events right now</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {top.map((e) => (
            <a
              key={e.id}
              href={e.url || "#"}
              target="_blank"
              rel="noreferrer"
              style={{
                border: "1px solid #2a2a2a",
                background: "#121212",
                borderRadius: 8,
                padding: 10,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {e.category} · {e.source} · importance {e.importance?.toFixed?.(1) ?? "n/a"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {e.time ? new Date(e.time).toLocaleString() : "timestamp unavailable"}
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
