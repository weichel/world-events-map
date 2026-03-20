"use client";

import { useEffect, useRef, useState } from "react";

type EventItem = {
  id: string;
  title: string;
  category: string;
  source: string;
  sourceType?: "api" | "rss";
  url?: string;
  time?: string;
  lat?: number;
  lon?: number;
  severity?: number;
  importance: number;
};

function shapeForSource(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("usgs")) return "shape-circle";
  if (s.includes("emsc")) return "shape-diamond";
  if (s.includes("gdacs")) return "shape-triangle";
  if (s.includes("eonet")) return "shape-square";
  if (s.includes("reliefweb")) return "shape-pentagon";
  if (s.includes("gdelt")) return "shape-star";
  return "shape-circle";
}

function colorForSeverity(severity = 0): { color: string; label: string } {
  if (severity >= 80) return { color: "#ff4d4f", label: "critical" };
  if (severity >= 60) return { color: "#fa8c16", label: "high" };
  if (severity >= 40) return { color: "#fadb14", label: "moderate" };
  return { color: "#52c41a", label: "low" };
}

export default function MapClient({ items }: { items: EventItem[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!ref.current || mapRef.current) return;
      const L = await import("leaflet");
      if (!alive || !ref.current) return;

      LRef.current = L;
      const worldBounds = L.latLngBounds(
        L.latLng(-85, -180),
        L.latLng(85, 180),
      );

      const map = L.map(ref.current, {
        worldCopyJump: false,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 2,
        maxZoom: 10,
      }).setView([20, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        noWrap: true,
        bounds: worldBounds,
      }).addTo(map);

      map.setMaxBounds(worldBounds);
      map.fitBounds(worldBounds);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    })();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !layerRef.current || !LRef.current) return;
    const L = LRef.current;

    layerRef.current.clearLayers();
    for (const e of items.slice(0, 1200)) {
      if (e.lat == null || e.lon == null) continue;
      const shapeClass = shapeForSource(e.source);
      const { color, label } = colorForSeverity(e.severity ?? e.importance ?? 0);
      const size = Math.max(10, Math.min(22, (e.importance ?? 40) / 4));

      const icon = L.divIcon({
        className: "event-marker-wrap",
        html: `<div class="event-marker ${shapeClass}" style="--marker-color:${color}; width:${size}px; height:${size}px"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([e.lat, e.lon], { icon });
      marker.bindPopup(
        `<div style="min-width:240px"><strong>${e.title}</strong><br/>${e.category} · ${e.source}<br/>importance: ${e.importance.toFixed(1)}<br/>Shape: ${shapeClass.replace("shape-", "")}<br/>Severity color: ${label} (${e.severity ?? "n/a"})${
          e.time ? `<br/>${new Date(e.time).toUTCString()}` : ""
        }${e.url ? `<br/><a href='${e.url}' target='_blank' rel='noreferrer'>source link</a>` : ""}</div>`,
      );
      marker.addTo(layerRef.current);
    }
  }, [items, mapReady]);

  return <div ref={ref} style={{ height: "70vh", width: "100%", borderRadius: 10, overflow: "hidden" }} />;
}
