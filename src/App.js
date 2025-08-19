import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

// ---------- Cone SVG helper (45° total angle, soft fade) ----------
function ConeSVG({ length = 140, angle = 45, color = "rgba(0,200,0,0.35)" }) {
  const half = angle / 2;
  const rad = (deg) => (deg * Math.PI) / 180;

  const x1 = Math.sin(rad(-half)) * length;
  const y1 = -Math.cos(rad(-half)) * length;
  const x2 = Math.sin(rad(half)) * length;
  const y2 = -Math.cos(rad(half)) * length;

  return (
    <svg
      width={length * 2}
      height={length * 2}
      viewBox={[-length, -length, length * 2, length * 2].join(" ")}
      style={{ display: "block", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={`M 0 0 L ${x1} ${y1} L ${x2} ${y2} Z`} fill="url(#coneGrad)" />
    </svg>
  );
}

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null); // dataURL of uploaded image
  const imgRef = useRef(null);
  const stageRef = useRef(null);

  // NEW: wrapper & overlay so markers align 1:1 with the displayed image box
  const imageWrapRef = useRef(null);
  const overlayRef = useRef(null);

  // --- Marker palette + selection ---
  const markerTypes = [
    { id: "camera", label: "Camera", iconSrc: require("./assets/camera.png") },
    { id: "door", label: "Door", iconSrc: require("./assets/door.png") },
    { id: "cardreader", label: "Card", iconSrc: require("./assets/card.png") },
    { id: "tv", label: "TV", iconSrc: require("./assets/tv.png") },
    { id: "wifi", label: "Wi-Fi", iconSrc: require("./assets/wifi.png") },
    { id: "projector", label: "Proj", iconSrc: require("./assets/projector.png") },
    { id: "speaker", label: "Speaker", iconSrc: require("./assets/speaker.png") },
    { id: "rack", label: "Rack", iconSrc: require("./assets/rack.png") },
    { id: "vape", label: "Vape", iconSrc: require("./assets/vape.png") },
  ];
  const [selectedTypeId, setSelectedTypeId] = useState(null);

  // --- Placed markers (normalized coords 0..1)
  const [placed, setPlaced] = useState([]); // {id, typeId, x, y, iconSrc, rotation?}

  // --- File inputs ---
  const importInputRef = useRef(null);

  // --- Export filename modal ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("layout");

  // --- Drag state (move markers) ---
  // pending: pointerdown happened on a marker but hasn't moved far yet
  // active: actual drag in progress
  const dragState = useRef({
    pending: false,
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    moved: false,
    pointerId: null,
  });

  // --- Rotation state (rotate cones) ---
  const rotateState = useRef({
    active: false,
    id: null,
    pointerId: null,
  });
  const [activeRotateId, setActiveRotateId] = useState(null);

  // suppress a click right after dragging so we don't place a new marker
  const justDraggedRef = useRef(false);

  // -------------- Helpers --------------

  const getSelectedType = () =>
    markerTypes.find((m) => m.id === selectedTypeId) || null;

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

  const isConeType = (typeId) => typeId === "camera" || typeId === "projector" || typeId === "speaker";

  const coneColorFor = (typeId) => {
  switch (typeId) {
    case "camera":
      return "rgba(255, 0, 0, 0.35)"; // red
    case "projector":
      return "rgba(255, 204, 0, 0.35)"; // yellow
    case "speaker":
      return "rgba(255, 165, 0, 0.35)"; // orange
    default:
      return "rgba(0, 200, 0, 0.35)"; // fallback green
  }
};

  // -------------- Import --------------

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/json") {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.imageData || !Array.isArray(data.markers))
        throw new Error("Invalid JSON");
  
      setImageSrc(data.imageData);
      setPlaced(
        data.markers.map((m) => ({
          id: m.id || crypto.randomUUID(),
          typeId: m.typeId,
          x: m.x,
          y: m.y,
          iconSrc: markerTypes.find((t) => t.id === m.typeId)?.iconSrc,
          rotation:
            typeof m.rotation === "number"
              ? m.rotation
              : isConeType(m.typeId)
              ? 0
              : null,
          coneColor: isConeType(m.typeId)
            ? coneColorFor(m.typeId)
            : null, // ✅ restore cone color on import
        }))
      );
    } catch (err) {
      alert("Failed to import JSON: " + err.message);
    }
  }

   else if (file.type.startsWith("image/")) {
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
    } catch {
      /* continue even if conversion fails */
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
        ...(typeof m.rotation === "number" ? { rotation: m.rotation } : {}),
      })),
    };
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a1 = document.createElement("a");
    a1.href = jsonUrl;
    a1.download = `${safeName}.json`;
    a1.click();
    URL.revokeObjectURL(jsonUrl);

    // Scale html2canvas to the natural image resolution
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

  const placeMarkerAtEvent = (e) => {
  if (!getSelectedType() && !e.target.closest?.("[data-marker-id]")) {
    setActiveRotateId(null);
  }

  if (!getSelectedType() || !overlayRef.current) return;

  const onMarker = e.target.closest?.("[data-marker-id]");
  const onRotate = e.target.closest?.("[data-rotate-handle]");
  if (onMarker || onRotate) return;

  if (justDraggedRef.current) {
    justDraggedRef.current = false;
    return;
  }

  const rect = overlayRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  const type = getSelectedType();
  setPlaced((list) => [
    ...list,
    {
      id: crypto.randomUUID(),
      typeId: type.id,
      x,
      y,
      iconSrc: type.iconSrc,
      rotation: isConeType(type.id) ? 0 : null,
      coneColor: isConeType(m.typeId) ? coneColorFor(m.typeId) : null, // ✅ store color per marker
    },
  ]);
};


  // Begin a pending drag (do not immediately set pointer capture)
  const beginPendingDrag = (id, e) => {
    if (!overlayRef.current) return;

    // Ignore rotate-handle pointerdowns here
    if (e.target.closest?.("[data-rotate-handle]")) return;

    const marker = placed.find((m) => m.id === id);
    if (!marker) return;

    dragState.current = {
      pending: true,
      active: false,
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: marker.x,
      initialY: marker.y,
      moved: false,
      pointerId: e.pointerId,
    };
    // do not call preventDefault or setPointerCapture here so clicks fire
  };

  // Begin rotating when user drags the handle
  const startRotate = (markerId, e) => {
    if (!overlayRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    // ensure visible (harmless if already visible)
    setActiveRotateId(markerId);

    const pointerId = e.pointerId;
    rotateState.current = { active: true, id: markerId, pointerId };
    try {
      overlayRef.current.setPointerCapture(pointerId);
    } catch {}
  };

  // pointer move: handle rotation first, then potential pending->active drag, then active drag
  const onPointerMove = (e) => {
    // Rotation drag
    if (rotateState.current.active && overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      const marker = placed.find((m) => m.id === rotateState.current.id);
      if (marker) {
        const cx = rect.left + marker.x * rect.width;
        const cy = rect.top + marker.y * rect.height;

        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        const angleFromX = (Math.atan2(dy, dx) * 180) / Math.PI;
        const angleUp = angleFromX - 90; // so 0° is up
        const normalized = ((angleUp % 360) + 360) % 360;

        setPlaced((list) =>
          list.map((m) => (m.id === marker.id ? { ...m, rotation: normalized } : m))
        );
      }
      return;
    }

    // If we have a pending pointerdown, promote if moved enough
    if (dragState.current.pending && !dragState.current.active) {
      const dxPx = Math.abs(e.clientX - dragState.current.startX);
      const dyPx = Math.abs(e.clientY - dragState.current.startY);
      if (dxPx > 4 || dyPx > 4) {
        // Promote to active drag
        dragState.current.active = true;
        dragState.current.moved = true;
        try {
          overlayRef.current.setPointerCapture(dragState.current.pointerId);
        } catch {}
      } else {
        // still a tap candidate — do not update location yet
        return;
      }
    }

    // Move drag (active)
    if (!dragState.current.active || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragState.current.startX) / rect.width;
    const dy = (e.clientY - dragState.current.startY) / rect.height;

    if (!dragState.current.moved) {
      if (Math.abs(e.clientX - dragState.current.startX) > 2 || Math.abs(e.clientY - dragState.current.startY) > 2) {
        dragState.current.moved = true;
      }
    }

    const newX = dragState.current.initialX + dx;
    const newY = dragState.current.initialY + dy;
    const clampedX = Math.max(0, Math.min(1, newX));
    const clampedY = Math.max(0, Math.min(1, newY));

    setPlaced((list) =>
      list.map((m) =>
        m.id === dragState.current.id ? { ...m, x: clampedX, y: clampedY } : m
      )
    );
  };

  // endDrag handles rotation end, pending-click reset, and finishing active drag
  const endDrag = (e) => {
    // finish rotation drag?
    if (rotateState.current.active) {
      try {
        if (overlayRef.current && rotateState.current.pointerId != null) {
          overlayRef.current.releasePointerCapture(rotateState.current.pointerId);
        }
      } catch {}
      rotateState.current = { active: false, id: null, pointerId: null };
      // prevent accidental placement
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 0);
      return;
    }

    // If it was a pending tap (no move) -> do nothing here; click handler on marker handles toggle
    if (dragState.current.pending && !dragState.current.active && !dragState.current.moved) {
      // reset pending state; onClick will already have fired (toggle handled there)
      dragState.current = {
        pending: false,
        active: false,
        id: null,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        moved: false,
        pointerId: null,
      };
      return;
    }

    // finish an active move drag
    if (!dragState.current.active) return;

    e.stopPropagation();
    e.preventDefault();

    if (dragState.current.moved) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
    }

    try {
      if (overlayRef.current && dragState.current.pointerId != null) {
        overlayRef.current.releasePointerCapture(dragState.current.pointerId);
      }
    } catch {}

    dragState.current = {
      pending: false,
      active: false,
      id: null,
      startX: 0,
      startY: 0,
      initialX: 0,
      initialY: 0,
      moved: false,
      pointerId: null,
    };
  };

  const removeMarker = (id) => {
    setPlaced((list) => list.filter((m) => m.id !== id));
    if (activeRotateId === id) setActiveRotateId(null);
  };

  // -------------- UI --------------

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        background: "#f5f7fb",
        minHeight: "100vh",
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
                <img src={m.iconSrc} alt={m.label} style={{ width: 24, height: 24 }} />
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
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
                Upload Floorplan
              </div>
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
              padding: 8, // this padding no longer throws markers off
              maxWidth: "min(95vw, 1200px)",
              overflow: "auto",
              touchAction: "auto",
            }}
          >
            {/* Image + overlay wrapper */}
            <div
              ref={imageWrapRef}
              style={{
                position: "relative",
                display: "inline-block",
                width: "100%",
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
                  pointerEvents: "auto",
                  touchAction: "auto",
                }}
                draggable={false}
              />

              {/* Overlay covers exactly the rendered image area */}
              <div
                ref={overlayRef}
                // Placement on click (suppressed if just dragged)
                onClick={placeMarkerAtEvent}
                onPointerDown={(e) => {
                  const handleEl = e.target.closest?.("[data-rotate-handle]");
                  if (handleEl) {
                    startRotate(handleEl.getAttribute("data-marker-id"), e);
                    return;
                  }
                  const marker = e.target.closest?.("[data-marker-id]");
                  if (marker) beginPendingDrag(marker.dataset.markerId, e);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 8,
                  pointerEvents: "auto",
                  touchAction: "auto", // important for touch-to-drag behavior
                }}
              >
                {/* Markers layer */}
                {placed.map((m) => {
                  const type = markerTypes.find((t) => t.id === m.typeId);
                  const showCone = isConeType(m.typeId);
                  const rotation = typeof m.rotation === "number" ? m.rotation : 0;

                  const content = type?.iconSrc ? (
                    <img
                      src={type.iconSrc}
                      alt={type?.label || "icon"}
                      style={{
                        width: 32,
                        height: 32,
                        minWidth: 32,
                        minHeight: 32,
                        objectFit: "contain",
                        pointerEvents: "none", // image itself doesn't steal events
                      }}
                    />
                  ) : null;

                  return (
                    <div
                      key={m.id}
                      data-marker-id={m.id}
                      onDoubleClick={() => removeMarker(m.id)}
                      onClick={(e) => {
                        // Toggle rotate handle only for cone-capable types
                        if (!showCone) return;
                        if (justDraggedRef.current) return;
                        e.stopPropagation();
                        setActiveRotateId((cur) => (cur === m.id ? null : m.id));
                      }}
                      style={{
                        position: "absolute",
                        left: `${m.x * 100}%`,
                        top: `${m.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        cursor: "grab",
                        userSelect: "none",
                        touchAction: "none",
                        background: "transparent",
                        padding: 0,
                        boxShadow: "none",
                      }}
                      title={
                        showCone
                          ? "Click to rotate • Drag to move • Double-click to delete"
                          : "Drag to move • Double-click to delete"
                      }
                    >
                      {/* Cone (behind icon) */}
                      {showCone && (
                        <div
                          key={m.id + "-cone"} // unique key per marker
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
                            transformOrigin: "50% 50%",
                            pointerEvents: "none",
                          }}
                        >
                          <ConeSVG length={140} angle={45} color={m.coneColor || coneColorFor(m.typeId)} />
                        </div>
                      )}


                      {/* Icon (above) */}
                      <div style={{ position: "relative", zIndex: 1 }}>{content}</div>

                      {/* Rotation handle (visible when active) */}
                      {showCone && activeRotateId === m.id && (
                        <div
                          data-rotate-handle
                          data-marker-id={m.id}
                          // place the handle 70px away in the current cone direction
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: `translate(-50%,-50%) rotate(${rotation}deg) translate(0, -70px)`,
                            transformOrigin: "50% 50%",
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "2px solid #1976d2",
                            background: "#fff",
                            boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                            cursor: "grab",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
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
