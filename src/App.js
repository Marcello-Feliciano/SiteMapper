import React, { useMemo, useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";

const ICON_SIZE = 40; // one size to rule them all (grid + placed)

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null); // dataURL of uploaded image
  const [markers, setMarkers] = useState([]); // {id, src, x, y}
  const stageRef = useRef(null);

  // --- Stable icon list (fixes ESLint dependency warning) ---
  const baseMarkerTypes = useMemo(
    () => [
      { id: "camera", label: "Camera", src: require("./assets/camera.png") },
      { id: "door", label: "Door", src: require("./assets/door.png") },
      { id: "cardreader", label: "Card", src: require("./assets/card.png") },
      { id: "tv", label: "TV", src: require("./assets/tv.png") },
      { id: "wifi", label: "Wi-Fi", src: require("./assets/wifi.png") },
      { id: "projector", label: "Proj", src: require("./assets/projector.png") },
      { id: "speaker", label: "Speaker", src: require("./assets/speaker.png") },
      { id: "rack", label: "Rack", src: require("./assets/rack.png") },
      { id: "vape", label: "Vape", src: require("./assets/vape.png") },
    ],
    []
  );

  // (Optional) Preload icons
  useEffect(() => {
    baseMarkerTypes.forEach((m) => {
      const img = new Image();
      img.src = m.src;
    });
  }, [baseMarkerTypes]);

  // --- File import/export handlers ---
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/json") {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        setImageSrc(data.imageSrc || data.image || null);
        setMarkers(Array.isArray(data.markers) ? data.markers : []);
      } catch (err) {
        alert("Failed to import JSON: " + err.message);
      }
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setMarkers([]);
      };
      reader.readAsDataURL(file);
    }
    // clear the input so same file can be reselected
    e.target.value = "";
  };

  const handleExport = async () => {
    if (!stageRef.current) return;

    // Export JSON (image + markers)
    const jsonData = JSON.stringify({ imageSrc, markers }, null, 2);
    const jsonBlob = new Blob([jsonData], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a1 = document.createElement("a");
    a1.href = jsonUrl;
    a1.download = "layout.json";
    a1.click();
    URL.revokeObjectURL(jsonUrl);

    // Export PNG of the stage
    const canvas = await html2canvas(stageRef.current, {
      useCORS: true,
      backgroundColor: null,
    });
    const a2 = document.createElement("a");
    a2.href = canvas.toDataURL("image/png");
    a2.download = "layout.png";
    a2.click();
  };

  // --- Add marker from palette ---
  const handleAddMarker = (icon) => {
    if (!icon?.src) return;
    setMarkers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        src: icon.src,
        x: 20, // initial px (relative to stage)
        y: 20,
      },
    ]);
  };

  // --- Pointer-based dragging (mouse + touch) ---
  const dragRef = useRef({
    id: null,
    pointerId: null,
    dx: 0,
    dy: 0,
  });

  const startDrag = (markerId, e) => {
    if (!stageRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = stageRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const marker = markers.find((m) => m.id === markerId);
    if (!marker) return;

    dragRef.current.id = markerId;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.dx = pointerX - marker.x;
    dragRef.current.dy = pointerY - marker.y;

    try {
      stageRef.current.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onStagePointerMove = (e) => {
    const { id, dx, dy } = dragRef.current;
    if (!id || !stageRef.current) return;

    const rect = stageRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left - dx;
    let y = e.clientY - rect.top - dy;

    // clamp within stage (so icons don't disappear)
    const maxX = Math.max(0, rect.width - ICON_SIZE);
    const maxY = Math.max(0, rect.height - ICON_SIZE);
    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);

    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, x, y } : m)));
  };

  const endDrag = () => {
    dragRef.current = { id: null, pointerId: null, dx: 0, dy: 0 };
  };

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        background: "#f5f7fb",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 56,
          background: "#1976d2",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,.12)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 700 }}>JobSite Marker</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={!imageSrc}
            title="Export JSON + PNG"
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.7)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: imageSrc ? "pointer" : "not-allowed",
            }}
          >
            Export
          </button>
          <label
            style={{
              background: "#fff",
              color: "#1976d2",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Import
            <input
              type="file"
              accept="image/png,image/jpeg,application/json"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </header>

      {/* Palette */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "#eef3fb",
          borderBottom: "1px solid #dde5f1",
        }}
      >
        <div style={{ fontWeight: 600, color: "#365" }}>Markers:</div>
        {baseMarkerTypes.map((m) => (
          <button
            key={m.id}
            onClick={() => handleAddMarker(m)}
            title={m.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #c9d6ea",
              background: "#fff",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <img
              src={m.src}
              alt={m.label}
              style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                objectFit: "contain",
                display: "block",
              }}
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Stage */}
      <main style={{ padding: 16, display: "flex", justifyContent: "center" }}>
        <div
          ref={stageRef}
          onPointerMove={onStagePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            position: "relative",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(16,24,40,.06)",
            width: "min(95vw, 1000px)",
            height: "min(70vh, 650px)",
            overflow: "hidden",
            touchAction: "none",
          }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Floorplan"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                color: "#98a2b3",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                padding: 24,
              }}
            >
              <div style={{ fontSize: 36 }}>🏢</div>
              <div style={{ fontWeight: 600 }}>No projects yet</div>
              <div style={{ fontSize: 13 }}>
                Import a floorplan (PNG/JPG) or a saved JSON to get started
              </div>
            </div>
          )}

          {/* Placed markers */}
          {markers.map((m) => (
            <img
              key={m.id}
              src={m.src}
              alt=""
              onPointerDown={(e) => startDrag(m.id, e)}
              style={{
                position: "absolute",
                left: m.x,
                top: m.y,
                width: ICON_SIZE,
                height: ICON_SIZE,
                objectFit: "contain",
                cursor: "grab",
                userSelect: "none",
                touchAction: "none",
              }}
              draggable={false}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
