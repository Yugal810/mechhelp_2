import { useEffect, useRef } from "react";
import L from "leaflet";

const NAGPUR = [21.1458, 79.0882];

function pinIcon(kind = "garage") {
  return L.divIcon({
    className: "mh-pin",
    html: `<div class="mh-pin-inner ${
      kind === "origin" ? "is-origin" : kind === "active" ? "is-active" : ""
    }"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

export default function MapView({
  origin,
  garages = [],
  activeId = null,
  isCollapsed = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: NAGPUR,
      zoom: 12,
    });

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    ).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();

    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 360);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isCollapsed]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points = [];

    if (origin?.lat && origin?.lon) {
      const pos = [origin.lat, origin.lon];
      points.push(pos);
      L.marker(pos, { icon: pinIcon("origin") }).addTo(layer);
    }

    garages.forEach((g) => {
      if (!g.lat || !g.lon) return;
      const pos = [g.lat, g.lon];
      points.push(pos);
      const id = `${g.garage_name}-${g.lat}`;
      L.marker(pos, {
        icon: pinIcon(id === activeId ? "active" : "garage"),
      }).addTo(layer);
    });

    map.invalidateSize();

    if (!points.length) {
      map.setView(NAGPUR, 12);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [origin, garages, activeId]);

  return (
    <div className="map-plane">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
