import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

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
  severity: number; // 0-100
  importance?: number;
};

type SourceStatus = {
  source: string;
  ok: boolean;
  count: number;
  note?: string;
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function toIso(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET() {
  const out: EventItem[] = [];
  const sources: SourceStatus[] = [];
  const xml = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

  // USGS earthquakes
  try {
    const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", {
      next: { revalidate: 300 },
    });
    let count = 0;
    if (res.ok) {
      const data = await res.json();
      for (const f of data.features ?? []) {
        const [lon, lat] = f?.geometry?.coordinates ?? [];
        const mag = Number(f?.properties?.mag ?? 0);
        out.push({
          id: `usgs-${f.id}`,
          title: f?.properties?.title ?? "Earthquake",
          category: "earthquake",
          source: "USGS",
          sourceType: "api",
          url: f?.properties?.url,
          time: f?.properties?.time ? new Date(f.properties.time).toISOString() : undefined,
          lat: Number.isFinite(lat) ? lat : undefined,
          lon: Number.isFinite(lon) ? lon : undefined,
          severity: clamp(mag * 14 + 10),
        });
        count++;
      }
    }
    sources.push({ source: "USGS", ok: true, count });
  } catch {
    sources.push({ source: "USGS", ok: false, count: 0, note: "fetch failed" });
  }

  // NASA EONET
  try {
    const res = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30", {
      next: { revalidate: 600 },
    });
    let count = 0;
    if (res.ok) {
      const data = await res.json();
      for (const e of data.events ?? []) {
        const latest = e?.geometry?.[e.geometry.length - 1];
        const coords = latest?.coordinates;
        const [lon, lat] = Array.isArray(coords) ? coords : [undefined, undefined];
        out.push({
          id: `eonet-${e.id}`,
          title: e.title,
          category: String(e?.categories?.[0]?.title ?? "natural-event").toLowerCase(),
          source: "NASA EONET",
          sourceType: "api",
          url: e?.sources?.[0]?.url,
          time: toIso(latest?.date),
          lat: num(lat),
          lon: num(lon),
          severity: 55,
        });
        count++;
      }
    }
    sources.push({ source: "NASA EONET", ok: true, count });
  } catch {
    sources.push({ source: "NASA EONET", ok: false, count: 0, note: "fetch failed" });
  }

  // GDACS RSS (disasters/alerts)
  try {
    const res = await fetch("https://www.gdacs.org/xml/rss.xml", { next: { revalidate: 600 } });
    let count = 0;
    if (res.ok) {
      const parsed = xml.parse(await res.text());
      const items = asArray(parsed?.rss?.channel?.item);
      for (const it of items) {
        const [latS, lonS] = String(it?.point ?? "").split(" ");
        out.push({
          id: `gdacs-${it?.guid ?? it?.link ?? Math.random()}`,
          title: it?.title ?? "GDACS Event",
          category: "disaster",
          source: "GDACS",
          sourceType: "rss",
          url: it?.link,
          time: toIso(it?.pubDate),
          lat: num(latS),
          lon: num(lonS),
          severity: 70,
        });
        count++;
      }
    }
    sources.push({ source: "GDACS", ok: true, count });
  } catch {
    sources.push({ source: "GDACS", ok: false, count: 0, note: "fetch failed" });
  }

  // EMSC earthquakes RSS
  try {
    const res = await fetch("https://www.emsc-csem.org/service/rss/rss.php?typ=emsc", { next: { revalidate: 300 } });
    let count = 0;
    if (res.ok) {
      const parsed = xml.parse(await res.text());
      const items = asArray(parsed?.rss?.channel?.item);
      for (const it of items) {
        const lat = num(it?.lat);
        const lon = num(it?.long);
        const magMatch = String(it?.title ?? "").match(/M\s*([0-9.]+)/i);
        const mag = magMatch ? Number(magMatch[1]) : 0;
        out.push({
          id: `emsc-${it?.guid ?? it?.link ?? Math.random()}`,
          title: it?.title ?? "EMSC Earthquake",
          category: "earthquake",
          source: "EMSC",
          sourceType: "rss",
          url: it?.link,
          time: toIso(it?.pubDate),
          lat,
          lon,
          severity: clamp(mag * 14 + 10),
        });
        count++;
      }
    }
    sources.push({ source: "EMSC", ok: true, count });
  } catch {
    sources.push({ source: "EMSC", ok: false, count: 0, note: "fetch failed" });
  }

  // ReliefWeb (often lacks point coords in basic feed)
  try {
    const body = {
      appname: "world-events-map",
      profile: "full",
      limit: 100,
      sort: ["date:desc"],
      filter: { field: "primary_type.name", value: "Disaster" },
      fields: { include: ["id", "title", "url", "date", "country"] },
    };
    const res = await fetch("https://api.reliefweb.int/v1/disasters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 900 },
    });
    let count = 0;
    if (res.ok) {
      const data = await res.json();
      for (const d of data?.data ?? []) {
        const f = d?.fields ?? {};
        const country = asArray(f?.country).map((c: any) => c?.name).filter(Boolean).join(", ");
        out.push({
          id: `reliefweb-${d?.id}`,
          title: country ? `${f?.title} (${country})` : f?.title,
          category: "humanitarian",
          source: "ReliefWeb",
          sourceType: "api",
          url: f?.url,
          time: toIso(f?.date?.created),
          severity: 62,
        });
        count++;
      }
    }
    sources.push({ source: "ReliefWeb", ok: true, count, note: "many records have no point coords" });
  } catch {
    sources.push({ source: "ReliefWeb", ok: false, count: 0, note: "fetch failed" });
  }

  // GDELT DOC API (news-signal events; usually no direct lat/lon per record)
  try {
    const query = encodeURIComponent("(earthquake OR flood OR wildfire OR conflict OR coup OR war) lang:English");
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&maxrecords=100&format=json`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    let count = 0;
    if (res.ok) {
      const data = await res.json();
      for (const a of data?.articles ?? []) {
        out.push({
          id: `gdelt-${a?.url ?? Math.random()}`,
          title: a?.title ?? "GDELT event article",
          category: "news-signal",
          source: "GDELT",
          sourceType: "api",
          url: a?.url,
          time: toIso(a?.seendate),
          severity: 48,
        });
        count++;
      }
    }
    sources.push({ source: "GDELT", ok: true, count, note: "news events; no direct point coords" });
  } catch {
    sources.push({ source: "GDELT", ok: false, count: 0, note: "fetch failed" });
  }

  const now = Date.now();
  const scored = out.map((e) => {
    const ageHours = e.time ? Math.max(0, (now - new Date(e.time).getTime()) / 36e5) : 72;
    const recency = 100 / (1 + ageHours / 24);
    const locationBonus = e.lat != null && e.lon != null ? 5 : 0;
    const importance = clamp(e.severity * 0.7 + recency * 0.25 + locationBonus);
    return { ...e, importance };
  });

  scored.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    count: scored.length,
    mappedCount: scored.filter((x) => x.lat != null && x.lon != null).length,
    items: scored.slice(0, 2000),
    sources,
  });
}
