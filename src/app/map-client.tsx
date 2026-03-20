"use client";

import { useEffect, useRef } from "react";

type EventItem = {
  id: string;
  title: string;
  category: string;
  source: string;
  url?: string;
  time?: string;
  lat: number;
  lon: number;
  importance: number;
};

export default function MapClient({ items }: { items: EventItem[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!ref.current || mapRef.current) return;
      const L = await import("leaflet");
      if (!alive || !ref.current) return;

      LRef.current = L;
      const map = L.map(ref.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!layerRef.current || !LRef.current) return;
    const L = LRef.current;

    layerRef.current.clearLayers();
    for (const e of items.slice(0, 800)) {
      const color = e.importance > 70 ? "#ff4d4f" : e.importance > 50 ? "#faad14" : "#52c41a";
      const marker = L.circleMarker([e.lat, e.lon], {
        radius: Math.max(4, Math.min(14, e.importance / 10)),
        color,
        fillOpacity: 0.65,
      });
      marker.bindPopup(
        `<div style="min-width:220px"><strong>${e.title}</strong><br/>${e.category} · ${e.source}<br/>importance: ${e.importance.toFixed(
          1,
        )}${e.time ? `<br/>${new Date(e.time).toLocaleString()}` : ""}${
          e.url ? `<br/><a href='${e.url}' target='_blank' rel='noreferrer'>source link</a>` : ""
        }</div>`,
      );
      marker.addTo(layerRef.current);
    }
  }, [items]);

  return <div ref={ref} style={{ height: "70vh", width: "100%", borderRadius: 10, overflow: "hidden" }} />;
}
