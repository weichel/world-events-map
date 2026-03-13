import { NextResponse } from "next/server";

type EventItem = {
  id: string;
  title: string;
  category: string;
  source: string;
  url?: string;
  time?: string;
  lat: number;
  lon: number;
  severity: number; // 0-100
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET() {
  const out: EventItem[] = [];

  // 1) USGS earthquakes (last day)
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const data = await res.json();
      for (const f of data.features ?? []) {
        const mag = Number(f?.properties?.mag ?? 0);
        const title = f?.properties?.title ?? "Earthquake";
        const url = f?.properties?.url;
        const time = f?.properties?.time ? new Date(f.properties.time).toISOString() : undefined;
        const [lon, lat] = f?.geometry?.coordinates ?? [];
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          out.push({
            id: `usgs-${f.id}`,
            title,
            category: "earthquake",
            source: "USGS",
            url,
            time,
            lat,
            lon,
            severity: clamp(mag * 14 + 10),
          });
        }
      }
    }
  } catch {}

  // 2) NASA EONET natural events
  try {
    const res = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30", {
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const data = await res.json();
      for (const e of data.events ?? []) {
        const latest = e?.geometry?.[e.geometry.length - 1];
        const coords = latest?.coordinates;
        const date = latest?.date;
        const cat = e?.categories?.[0]?.title ?? "natural-event";
        if (Array.isArray(coords) && coords.length >= 2) {
          const [lon, lat] = coords;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            out.push({
              id: `eonet-${e.id}`,
              title: e.title,
              category: String(cat).toLowerCase(),
              source: "NASA EONET",
              url: e?.sources?.[0]?.url,
              time: date,
              lat,
              lon,
              severity: 55,
            });
          }
        }
      }
    }
  } catch {}

  // 3) Global wildfire points (NASA FIRMS CSV proxy via EONET already partial; keep this simple for v1)

  out.sort((a, b) => (b.severity || 0) - (a.severity || 0));

  const now = Date.now();
  const scored = out.map((e) => {
    const ageHours = e.time ? Math.max(0, (now - new Date(e.time).getTime()) / 36e5) : 72;
    const recency = 100 / (1 + ageHours / 24);
    const importance = clamp(e.severity * 0.75 + recency * 0.25);
    return { ...e, importance };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    count: scored.length,
    items: scored.slice(0, 1200),
  });
}
