import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

// Import fixed icon images (place these in src/assets/ and resize to 128x128px)
import cameraIcon from './assets/camera.png';
import doorIcon from './assets/door.png';
import wifiIcon from './assets/wifi.png';
import tvIcon from './assets/tv.png';
import projectorIcon from './assets/projector.png';
import cardIcon from './assets/card.png';

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null); // dataURL of uploaded image
  const imgRef = useRef(null);
  const stageRef = useRef(null);

  // --- Marker palette + selection ---
  const markerTypes = [
    { id: "camera", label: "Camera", iconSrc: cameraIcon },
    { id: "door", label: "Door", iconSrc: doorIcon },
    { id: "cardreader", label: "Card", iconSrc: cardIcon },
    { id: "tv", label: "TV", iconSrc: tvIcon },
    { id: "wifi", label: "Wi-Fi", iconSrc: wifiIcon },
    { id: "projector", label: "Proj", iconSrc: projectorIcon },
  ];
  const [selectedTypeId, setSelectedTypeId] = useState(null);

  // --- Placed markers (normalized coords 0..1) ---
  const [placed, setPlaced] = useState([]); // {id, typeId, x, y, iconSrc}

  // --- File inputs ---
  const importInputRef = useRef(null);

  // --- Export filename modal ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("layout");

  // --- Drag state ---
  const dragState = useRef({ active: false, id: null, startX: 0, startY: 0 });

  // -------------- Helpers --------------

  const getSelectedType = () => markerTypes.find((m) => m.id === selectedTypeId) || null;

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const imageToDataURL = (src) =>
    new Promise((resolve, reject) => {
      if (!src) return reject(new Error("No image"));
      if (src.startsWith("data:")) return resolve(src);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });

  // -------------- Import --------------

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/json") {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.imageData || !Array.isArray(data.markers)) throw new Error("Invalid JSON");
        setImageSrc(data.imageData);
        setPlaced(
          data.markers.map((m) => ({
            id: m.id || crypto.randomUUID(),
            typeId: m.typeId,
            x: m.x,
            y: m.y,
            iconSrc: markerTypes.find((t) => t.id === m.typeId)?.iconSrc,
          }))
        );
      } catch (err) {
        alert("Failed to import JSON: " + err.message);
      }
    } else if (file.type.startsWith("image/")) {
      const dataURL = await readFileAsDataURL(file);
      setImageSrc(dataURL);
      setPlaced([]);
    } else {
      alert("Unsupported file type. Use PNG/JPG or a saved JSON.");
    }

    e.target.value = "";
  };

  // -------------- Export --------------

  const exportJSONandPNG = async (filenameBase) => {
    if (!imageSrc || !stageRef.current || !imgRef.current) return;

    const safeName = (filenameBase || "layout").trim() || "layout";

    let embeddedImage = imageSrc;
    try {
      embeddedImage = await imageToDataURL(imageSrc);
    } catch (e) {
      // continue; we’ll still export
    }
    const json = {
      version: 1,
      exportedAt: new Date().toISOString(),
      imageData: embeddedImage,
      markers: placed.map((m) => ({
        id: m.id,
        typeId: m.typeId,
        x: m.x,
        y: m.y,
        iconSrc: m.iconSrc,
      })),
    };
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a1 = document.createElement("a");
    a1.href = jsonUrl;
    a1.download = `${safeName}.json`;
    a1.click();
    URL.revokeObjectURL(jsonUrl);

    const imgEl = imgRef.current;
    const displayedW = imgEl.clientWidth;
    const displayedH = imgEl.clientHeight;
    const naturalW = imgEl.naturalWidth || displayedW;
    const naturalH = imgEl.naturalHeight || displayedH;

    const scaleX = naturalW / Math.max(1, displayedW);
    const scaleY = naturalH / Math.max(1, displayedH);
    const scale = Math.max(scaleX, scaleY);

    const canvas = await html2canvas(stageRef.current, {
      useCORS: true,
      backgroundColor: null,
      scale,
      onclone: (clonedDoc) => {
        const clonedImg = clonedDoc.getElementById("floorplan-image");
        if (clonedImg) {
          clonedImg.style.width = `${displayedW}px`;
          clonedImg.style.height = "auto";
          clonedImg.style.maxWidth = "none";
          clonedImg.style.maxHeight = "none";
        }
      },
    });

    const a2 = document.createElement("a");
    a2.href = canvas.toDataURL("image/png");
    a2.download = `${safeName}.png`;
    a2.click();
  };

  // -------------- Marker palette --------------

  const toggleSelectType = (typeId) => {
    setSelectedTypeId((cur) => (cur === typeId ? null : typeId));
  };

  // -------------- Placement + dragging --------------

  const handleStageClick = (e) => {
    if (!getSelectedType() || !imgRef.current || dragState.current.active) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    setPlaced((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        typeId: getSelectedType().id,
        x,
        y,
        iconSrc: getSelectedType().iconSrc,
      },
    ]);
  };

  const startDrag = (id, e) => {
    if (!imgRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const markerDiv = e.target.closest('[data-marker-id]');
    if (!markerDiv) return;

    const markerRect = markerDiv.getBoundingClientRect();
    dragState.current = {
      active: true,
      id,
      offsetX: e.clientX - markerRect.left,
      offsetY: e.clientY - markerRect.top,
    };
  };

  const onPointerMove = (e) => {
    if (!dragState.current.active || !imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - dragState.current.offsetX) / rect.width;
    const y = (e.clientY - dragState.current.offsetY) / rect.height;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    setPlaced((list) =>
      list.map((m) =>
        m.id === dragState.current.id ? { ...m, x: clampedX, y: clampedY } : m
      )
    );
  };

  const endDrag = (e) => {
    if (dragState.current.active) {
      dragState.current = { active: false, id: null, offsetX: 0, offsetY: 0 };
    }
  };

  const removeMarker = (id) => {
    setPlaced((list) => list.filter((m) => m.id !== id));
  };

  // -------------- UI --------------

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
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
            onClick={() => setShowExportModal(true)}
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
          <button
            onClick={handleImportClick}
            title="Import image or JSON"
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
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="image/png,image/jpeg,application/json"
            onChange={handleImportChange}
            style={{ display: "none" }}
          />
        </div>
      </header>

      {/* Marker palette */}
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
        {markerTypes.map((m) => {
          const selected = selectedTypeId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => toggleSelectType(m.id)}
              title={m.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                border: selected ? "2px solid #1976d2" : "1px solid #c9d6ea",
                background: selected ? "rgba(25,118,210,0.08)" : "#fff",
                cursor: "pointer",
                fontSize: 22,
                userSelect: "none",
              }}
            >
              <img src={m.iconSrc} alt={m.label} style={{ width: 24, height: 24 }} />
            </button>
          );
        })}
        {selectedTypeId && (
          <button
            onClick={() => setSelectedTypeId(null)}
            style={{
              marginLeft: 6,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #c9d6ea",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Deselect
          </button>
        )}
      </div>

      {/* Main content */}
      <main style={{ padding: 16, display: "flex", justifyContent: "center" }}>
        {!imageSrc ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            {/* Upload card */}
            <div
              onClick={handleImportClick}
              style={{
                width: 360,
                background: "#fff",
                borderRadius: 14,
                boxShadow: "0 8px 24px rgba(16,24,40,.08)",
                padding: 24,
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 44, color: "#1976d2", marginBottom: 8 }}>☁️</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Upload Floorplan</div>
              <div style={{ color: "#667085", fontSize: 14, marginBottom: 14 }}>
                Upload a building layout or floorplan to start adding markers
              </div>
              <div
                style={{
                  border: "2px dashed #cfd8e3",
                  borderRadius: 10,
                  padding: 16,
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                Tap to select file (PNG, JPG, or JSON)
              </div>
            </div>

            {/* Empty state */}
            <div style={{ marginTop: 56, color: "#98a2b3" }}>
              <div style={{ fontSize: 36 }}>🏢</div>
              <div style={{ fontWeight: 600 }}>No projects yet</div>
              <div style={{ fontSize: 13 }}>Upload a floorplan to get started</div>
            </div>
          </div>
        ) : (
          <div
            ref={stageRef}
            style={{
              position: "relative",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(16,24,40,.06)",
              padding: 8,
              maxWidth: "min(95vw, 1200px)",
              overflow: "auto",
              touchAction: "none",
            }}
          >
            {/* Image */}
            <img
              id="floorplan-image"
              ref={imgRef}
              alt="Floorplan"
              src={imageSrc}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                borderRadius: 8,
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />

            {/* Overlay receives events & holds markers */}
            <div
              ref={overlayRef}
              onClick={placeMarkerAtEvent}
              onPointerDown={(e) => {
                const el = e.target.closest?.("[data-marker-id]");
                if (!el) return;
                const id = el.dataset.markerId;
                if (rotateId === id) {
                  // rotate mode for this marker
                  startRotate(id, e);
                } else {
                  startDrag(id, e);
                }
              }}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 8,
                pointerEvents: "auto",
              }}
            >
              {/* SVG cones */}
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  borderRadius: 8,
                }}
              >
                {(() => {
                  // render cones in normalized SVG coords (0..1000)
                  const cones = [];
                  const radiusNorm = CONE_RADIUS_RATIO * 1000; // ~0.18 of min dim since viewBox is square
                  const a1 = (-HALF_FOV * Math.PI) / 180;
                  const a2 = (HALF_FOV * Math.PI) / 180;
                  const x1 = radiusNorm * Math.sin(a1);
                  const y1 = -radiusNorm * Math.cos(a1);
                  const x2 = radiusNorm * Math.sin(a2);
                  const y2 = -radiusNorm * Math.cos(a2);
                  const arc = `A ${radiusNorm} ${radiusNorm} 0 0 1 ${x2.toFixed(
                    3
                  )} ${y2.toFixed(3)}`;

                  placed.forEach((m) => {
                    if (m.typeId !== "camera" && m.typeId !== "projector") return;
                    const cx = m.x * 1000;
                    const cy = m.y * 1000;
                    const color =
                      m.typeId === "camera" ? CAMERA_COLOR : PROJECTOR_COLOR;
                    const angle = (m.angle || 0).toFixed(3);

                    cones.push(
                      <g
                        key={`cone-${m.id}`}
                        transform={`translate(${cx.toFixed(
                          3
                        )},${cy.toFixed(3)}) rotate(${angle})`}
                      >
                        <path
                          d={`M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(
                            3
                          )} ${arc} Z`}
                          fill={color}
                          stroke="none"
                        />
                      </g>
                    );
                  });
                  return cones;
                })()}
              </svg>

              {/* Markers (icons) */}
              {placed.map((m) => {
                const type = markerTypes.find((t) => t.id === m.typeId);
                return (
                  <div
                    key={m.id}
                    data-marker-id={m.id}
                    onDoubleClick={() => removeMarker(m.id)}
                    onClick={(e) => {
                      // Toggle rotate mode for this marker
                      e.stopPropagation();
                      if (rotateId === m.id) setRotateId(null);
                      else setRotateId(m.id);
                    }}
                    title={
                      rotateId === m.id
                        ? "Rotate mode: drag to rotate • Click to exit • Double-tap to delete"
                        : "Drag to move • Click to enter rotate mode • Double-tap to delete"
                    }
                    style={{
                      position: "absolute",
                      left: `${m.x * 100}%`,
                      top: `${m.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      cursor: rotateId === m.id ? "crosshair" : "grab",
                      userSelect: "none",
                      touchAction: "none",
                      background: "transparent",
                      padding: 0,
                      boxShadow: "none",
                    }}
                  >
                    <img
                      src={type?.iconSrc}
                      alt={type?.label || "icon"}
                      style={{
                        width: 32,
                        height: 32,
                        minWidth: 32,
                        minHeight: 32,
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Export filename modal */}
      {showExportModal && (
        <div
          onClick={() => setShowExportModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 16px 48px rgba(16,24,40,.2)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Export filename</div>
            <input
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              placeholder="layout"
              autoFocus
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                outline: "none",
                fontSize: 14,
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  exportJSONandPNG(exportFilename);
                  setShowExportModal(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "#1976d2",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Export
              </button>
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Exports <b>.json</b> (image + markers) and <b>.png</b> (full layout).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
