import React, { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";

// Import fixed icon images (assuming they are in src/assets/)
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
  const [markerTypes, setMarkerTypes] = useState([
    { id: "camera", label: "Camera", iconSrc: cameraIcon },
    { id: "door", label: "Door", iconSrc: doorIcon },
    { id: "cardreader", label: "Card", iconSrc: cardIcon },
    { id: "tv", label: "TV", iconSrc: tvIcon },
    { id: "wifi", label: "Wi-Fi", iconSrc: wifiIcon },
    { id: "projector", label: "Proj", iconSrc: projectorIcon },
  ]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);

  // --- Placed markers (normalized coords 0..1) ---
  const [placed, setPlaced] = useState([]); // {id, typeId, x, y, iconSrc}

  // --- File inputs ---
  const importInputRef = useRef(null);

  // --- Export filename modal ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("layout");

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
            iconSrc: markerTypes.find((t) => t.id === m.typeId)?.iconSrc, // Map to fixed icons
          }))
        );
      } catch (err) {
        alert("Failed to import JSON: " + err.message);
      }
    } else if (file.type.startsWith("image/")) {
      const dataURL = await readFileAsDataURL(file);
      setImageSrc(dataURL);
      setPlaced([]); // Clear markers on new image
    } else {
      alert("Unsupported file type. Use PNG/JPG or a saved JSON.");
    }

    e.target.value = "";
  };

  // -------------- Export --------------

  const exportJSONandPNG = async (filenameBase) => {
    if (!imageSrc || !stageRef.current || !imgRef.current) return;

    const safeName = (filenameBase || "layout").trim() || "layout";

    // JSON (embed image + markers)
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
        iconSrc: m.iconSrc, // Include fixed icon data
      })),
    };
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a1 = document.createElement("a");
    a1.href = jsonUrl;
    a1.download = `${safeName}.json`;
    a1.click();
    URL.revokeObjectURL(jsonUrl);

    // PNG (full image, not clipped; scale up to native)
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
    const selected = getSelectedType();
    if (!selected || !imgRef.current) return;

    // Check if click is intended for placement (not dragging)
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    // Only place a new marker if not dragging
    if (!e.buttons) { // e.buttons === 0 means no mouse button is pressed (just a click)
      setPlaced((list) => [
        ...list,
        {
          id: crypto.randomUUID(),
          typeId: selected.id,
          x,
          y,
          iconSrc: selected.iconSrc,
        },
      ]);
    }
  };

  // drag state
  const dragState = useRef({ id: null });

  const startDrag = (id, e) => {
    e.stopPropagation();
    dragState.current.id = id;
    stageRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const draggingId = dragState.current.id;
    if (!draggingId || !imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    setPlaced((list) => list.map((m) => (m.id === draggingId ? { ...m, x, y } : m)));
  };

  const endDrag = (e) => {
    if (dragState.current.id && stageRef.current?.releasePointerCapture) {
      try {
        stageRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    dragState.current.id = null;
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
              {m.iconSrc && (
                <img src={m.iconSrc} alt={m.label} style={{ width: 22, height: 22 }} />
              )}
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
            onClick={handleStageClick}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: "relative",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(16,24,40,.06)",
              padding: 8,
              maxWidth: "min(95vw, 1200px)",
              overflow: "auto",
            }}
          >
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

            {/* Markers layer */}
            {placed.map((m) => {
              const type = markerTypes.find((t) => t.id === m.typeId);
              const content = type?.iconSrc ? (
                <img
                  src={type.iconSrc}
                  alt={type?.label || "icon"}
                  style={{ width: 28, height: 28 }}
                />
              ) : null;

              return (
                <div
                  key={m.id}
                  onPointerDown={(e) => startDrag(m.id, e)}
                  onDoubleClick={() => removeMarker(m.id)}
                  style={{
                    position: "absolute",
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: "grab",
                    userSelect: "none",
                    touchAction: "none",
                    background: "rgba(255,255,255,0.7)",
                    borderRadius: 8,
                    padding: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                  }}
                  title="Drag to move • Double-click to delete"
                >
                  {content}
                </div>
              );
            })}
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
