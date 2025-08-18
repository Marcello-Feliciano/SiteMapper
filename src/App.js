import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// ---------- Cone SVG helper ----------
function ConeSVG({ length = 140, angle = 45, color = "rgba(0,200,0,0.35)" }) {
  const half = angle / 2;
  const rad = (deg) => (deg * Math.PI) / 180;
  const x1 = length * Math.cos(rad(-half));
  const y1 = length * Math.sin(rad(-half));
  const x2 = length * Math.cos(rad(half));
  const y2 = length * Math.sin(rad(half));
  return (
    <svg width={length * 2} height={length * 2} style={{ position: "absolute", left: -length, top: -length }}>
      <path
        d={`M${length},${length} L${x1 + length},${y1 + length} A${length},${length} 0 0,1 ${x2 + length},${
          y2 + length
        } Z`}
        fill={color}
      />
    </svg>
  );
}

export default function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeRotateId, setActiveRotateId] = useState(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [showCone, setShowCone] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const imgRef = useRef(null);
  const stageRef = useRef(null);

  // ---------- Marker Types ----------
  const markerTypes = [
    { type: "camera", icon: "📷" },
    { type: "door", icon: "🚪" },
    { type: "wifi", icon: "📡" },
    { type: "tv", icon: "📺" },
  ];

  const coneColorFor = (t) =>
    t === "camera" ? "rgba(0,200,0,0.35)" : t === "wifi" ? "rgba(0,0,200,0.25)" : "rgba(200,0,0,0.25)";

  // ---------- File Import ----------
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setImageSrc(reader.result);
      reader.readAsDataURL(file);
    } else if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = () => {
        const data = JSON.parse(reader.result);
        setImageSrc(data.imageSrc);
        setMarkers(data.markers || []);
      };
      reader.readAsText(file);
    }
  };

  // ---------- File Export ----------
  const handleExport = async () => {
    if (!stageRef.current) return;
    const node = stageRef.current;
    const canvas = await html2canvas(node, { backgroundColor: null, useCORS: true });
    const pngUrl = canvas.toDataURL("image/png");

    const json = JSON.stringify({ imageSrc, markers });
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "layout.json";
    a.click();

    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "layout.png";
    link.click();
  };

  // ---------- Place Markers ----------
  const placeMarkerAtEvent = (e) => {
    if (!activeId) return;
    const rect = stageRef.current.getBoundingClientRect();
    setMarkers((prev) => [
      ...prev,
      { id: Date.now(), type: activeId, x: e.clientX - rect.left, y: e.clientY - rect.top, rotation: 0 },
    ]);
  };

  // ---------- Drag / Rotate ----------
  const startDrag = (id, e) => {
    const rect = stageRef.current.getBoundingClientRect();
    const marker = markers.find((m) => m.id === id);
    setDragOffset({ id, dx: e.clientX - rect.left - marker.x, dy: e.clientY - rect.top - marker.y });
  };

  const startRotate = (id, e) => {
    setActiveRotateId(id);
    e.stopPropagation();
    e.preventDefault();
  };

  const handleMove = (e) => {
    if (dragOffset) {
      const rect = stageRef.current.getBoundingClientRect();
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === dragOffset.id
            ? { ...m, x: e.clientX - rect.left - dragOffset.dx, y: e.clientY - rect.top - dragOffset.dy }
            : m
        )
      );
    } else if (activeRotateId) {
      const rect = stageRef.current.getBoundingClientRect();
      const marker = markers.find((m) => m.id === activeRotateId);
      const cx = marker.x + 25;
      const cy = marker.y + 25;
      const angle = Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx);
      setMarkers((prev) => prev.map((m) => (m.id === activeRotateId ? { ...m, rotation: (angle * 180) / Math.PI } : m)));
    }
  };

  const handleUp = () => {
    setDragOffset(null);
    setActiveRotateId(null);
  };

  // ---------- UI ----------
  return (
    <div style={{ fontFamily: "Inter, system-ui", background: "#f5f7fb", minHeight: "100vh" }}>
      <header style={{ height: 60, background: "#334", color: "white", display: "flex", alignItems: "center", padding: "0 16px" }}>
        <h1 style={{ fontSize: 20, flexGrow: 1 }}>Site Mapper</h1>
        <button onClick={() => setShowCone((p) => !p)} style={{ marginRight: 8 }}>
          {showCone ? "Hide Cones" : "Show Cones"}
        </button>
        <input type="file" accept=".png,.jpg,.jpeg,.json" onChange={handleImport} />
        <button onClick={() => setShowExportModal(true)}>Export</button>
      </header>

      <main style={{ padding: 16, display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <aside>
          <h2>Markers</h2>
          {markerTypes.map((mt) => (
            <button
              key={mt.type}
              onClick={() => setActiveId((p) => (p === mt.type ? null : mt.type))}
              style={{ display: "block", marginBottom: 8, background: activeId === mt.type ? "#ccf" : "white" }}
            >
              {mt.icon} {mt.type}
            </button>
          ))}
        </aside>

        <div
          ref={stageRef}
          onClick={placeMarkerAtEvent}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#eee",
            minHeight: 500,
            touchAction: "none", // important for pinch-zoom
          }}
        >
          <TransformWrapper minScale={0.5} maxScale={4} wheel={{ step: 0.2 }}>
            <TransformComponent>
              {imageSrc && (
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="floorplan"
                  style={{ maxWidth: "100%", display: "block" }}
                  draggable={false}
                />
              )}

              {markers.map((m) => (
                <div
                  key={m.id}
                  data-marker-id={m.id}
                  style={{
                    position: "absolute",
                    left: m.x,
                    top: m.y,
                    width: 50,
                    height: 50,
                    transform: `rotate(${m.rotation}deg)`,
                    transformOrigin: "center",
                    cursor: "grab",
                  }}
                  onPointerDown={(e) => {
                    const handleEl = e.target.closest("[data-rotate-handle]");
                    if (handleEl) startRotate(m.id, e);
                    else startDrag(m.id, e);
                    e.stopPropagation();
                  }}
                >
                  <div style={{ fontSize: 32, textAlign: "center" }}>
                    {markerTypes.find((mt) => mt.type === m.type)?.icon || "❓"}
                  </div>
                  {showCone && <ConeSVG color={coneColorFor(m.type)} />}
                  <div
                    data-rotate-handle
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%,-50%) translate(0,-70px)",
                      width: 20,
                      height: 20,
                      background: "orange",
                      borderRadius: "50%",
                      cursor: "grab",
                    }}
                  />
                </div>
              ))}
            </TransformComponent>
          </TransformWrapper>
        </div>
      </main>

      {showExportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "white", padding: 20 }}>
            <h3>Export Options</h3>
            <button onClick={handleExport}>Download PNG + JSON</button>
            <button onClick={() => setShowExportModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
