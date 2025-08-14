import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef(null);
  const stageRef = useRef(null);

  // Wrappers/overlay so coords match exactly
  const overlayRef = useRef(null);

  // --- Marker palette + selection ---
  const markerTypes = [
    { id: "camera", label: "Camera", iconSrc: require("./assets/camera.png") },
    { id: "door", label: "Door", iconSrc: require("./assets/door.png") },
    { id: "cardreader", label: "Card", iconSrc: require("./assets/card.png") },
    { id: "tv", label: "TV", iconSrc: require("./assets/tv.png") },
    { id: "wifi", label: "Wi-Fi", iconSrc: require("./assets/wifi.png") },
    { id: "projector", label: "Proj", iconSrc: require("./assets/projector.png") },
  ];
  const [selectedTypeId, setSelectedTypeId] = useState(null);

  // --- Placed markers (normalized coords 0..1) ---
  // angle (deg) is used by camera/projector only
  const [placed, setPlaced] = useState([]); // {id,typeId,x,y,iconSrc,angle?}

  // Which marker (if any) is in "rotate mode"
  const [rotateId, setRotateId] = useState(null);

  // --- File inputs ---
  const importInputRef = useRef(null);

  // --- Export filename modal ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("layout");

  // --- Drag/Rotate state ---
  const dragState = useRef({
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    moved: false,
    pointerId: null,
  });

  const rotateState = useRef({
    active: false,
    id: null,
    centerX: 0,
    centerY: 0,
    pointerId: null,
    moved: false,
  });

  // suppress placement click after a drag/rotate
  const justDraggedRef = useRef(false);

  // --- Vis cone config (SVG overlay) ---
  const FOV_DEG = 45;              // total field-of-view
  const HALF_FOV = FOV_DEG / 2;
  const CAMERA_COLOR = "rgba(16,185,129,0.35)";   // teal/green
  const PROJECTOR_COLOR = "rgba(245,158,11,0.35)"; // amber
  const CONE_RADIUS_RATIO = 0.18;  // percent of min(imageWidth,imageHeight)

  // --- Rotation handle state ---
  const rotationHandleRef = useRef(null);

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
            angle: typeof m.angle === "number" ? m.angle : 0,
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
    } catch {}

    const json = {
      version: 2,
      exportedAt: new Date().toISOString(),
      imageData: embeddedImage,
      markers: placed.map((m) => ({
        id: m.id,
        typeId: m.typeId,
        x: m.x,
        y: m.y,
        iconSrc: m.iconSrc,
        angle: typeof m.angle === "number" ? m.angle : 0,
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

    // Scale html2canvas to natural image resolution
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

  // -------------- Placement + drag/rotate (on overlay) --------------
  const placeMarkerAtEvent = (e) => {
    if (!getSelectedType() || !overlayRef.current) return;

    // Don't place if clicking on a marker or just finished drag/rotate
    if (e.target.closest?.("[data-marker-id]")) return;
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
        angle: 0, // default orientation (up)
      },
    ]);
  };

  // Move
  const startDrag = (id, e) => {
    if (!overlayRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const marker = placed.find((m) => m.id === id);
    if (!marker) return;

    const pointerId = e.pointerId;

    dragState.current = {
      active: true,
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: marker.x,
      initialY: marker.y,
      moved: false,
      pointerId,
    };

    try {
      overlayRef.current.setPointerCapture(pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    // rotation takes precedence if active
    if (rotateState.current.active) {
      if (!overlayRef.current) return;

      const m = placed.find((p) => p.id === rotateState.current.id);
      if (!m) return;

      // marker center (client coords)
      const rect = overlayRef.current.getBoundingClientRect();
      const cx = rect.left + m.x * rect.width;
      const cy = rect.top + m.y * rect.height;

      // Angle: 0° is up
      const angle =
        (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;

      if (!rotateState.current.moved) {
        if (Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0) {
          rotateState.current.moved = true;
        }
      }

      setPlaced((list) =>
        list.map((it) => (it.id === m.id ? { ...it, angle } : it))
      );
      return;
    }

    // dragging position
    if (!dragState.current.active || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragState.current.startX) / rect.width;
    const dy = (e.clientY - dragState.current.startY) / rect.height;

    if (!dragState.current.moved) {
      if (Math.abs(e.clientX - dragState.current.startX) > 2 ||
          Math.abs(e.clientY - dragState.current.startY) > 2) {
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

  const endDrag = (e) => {
    let didMove = false;

    if (rotateState.current.active) {
      didMove = rotateState.current.moved;
      try {
        if (
          overlayRef.current &&
          rotateState.current.pointerId != null
        ) {
          overlayRef.current.releasePointerCapture(
            rotateState.current.pointerId
          );
        }
      } catch {}
      rotateState.current = {
        active: false,
        id: null,
        centerX: 0,
        centerY: 0,
        pointerId: null,
        moved: false,
      };
    } else if (dragState.current.active) {
      didMove = dragState.current.moved;
      try {
        if (overlayRef.current && dragState.current.pointerId != null) {
          overlayRef.current.releasePointerCapture(dragState.current.pointerId);
        }
      } catch {}
      dragState.current = {
        active: false,
        id: null,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        moved: false,
        pointerId: null,
      };
    }

    if (didMove) {
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 0);
    }

    e?.stopPropagation?.();
    e?.preventDefault?.();
  };

  const startRotate = (id, e) => {
    if (!overlayRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const m = placed.find((p) => p.id === id);
    if (!m || (m.typeId !== "camera" && m.typeId !== "projector")) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const cx = rect.left + m.x * rect.width;
    const cy = rect.top + m.y * rect.height;

    rotateState.current = {
      active: true,
      id,
      centerX: cx,
      centerY: cy,
      pointerId: e.pointerId,
      moved: false,
    };

    // Create or update rotation handle
    if (!rotationHandleRef.current) {
      const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handle.setAttribute("r", 8);
      handle.setAttribute("fill", "orange");
      handle.style.cursor = "grab";
      rotationHandleRef.current = handle;
      overlayRef.current.querySelector("svg")?.appendChild(handle);
    }
    const bbox = { x: m.x * 1000 - 16, y: m.y * 1000 - 20, width: 32, height: 32 }; // Normalized SVG coords
    rotationHandleRef.current.setAttribute("cx", (bbox.x + bbox.width / 2).toFixed(3));
    rotationHandleRef.current.setAttribute("cy", (bbox.y).toFixed(3));
    rotationHandleRef.current.addEventListener("pointerdown", startHandleRotate);

    try {
      overlayRef.current.setPointerCapture(e.pointerId);
    } catch {}
  };

  const startHandleRotate = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const m = placed.find((p) => p.id === rotateId);
    if (!m) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const svgRect = overlayRef.current.querySelector("svg").getBoundingClientRect();
    const cx = parseFloat(rotationHandleRef.current.getAttribute("cx")) * (rect.width / 1000) + svgRect.left;
    const cy = parseFloat(rotationHandleRef.current.getAttribute("cy")) * (rect.height / 1000) + svgRect.top;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    rotateState.current.rotationStartAngle = Math.atan2(y - cy, x - cx);
    rotateState.current.iconStartAngle = m.angle || 0;

    window.addEventListener("pointermove", rotateIcon);
    window.addEventListener("pointerup", stopRotate);
  };

  const rotateIcon = (e) => {
    if (!rotateState.current.active || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const svgRect = overlayRef.current.querySelector("svg").getBoundingClientRect();
    const cx = parseFloat(rotationHandleRef.current.getAttribute("cx")) * (rect.width / 1000) + svgRect.left;
    const cy = parseFloat(rotationHandleRef.current.getAttribute("cy")) * (rect.height / 1000) + svgRect.top;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90;

    const deltaAngle = angle - rotateState.current.rotationStartAngle * (180 / Math.PI);
    const newAngle = (rotateState.current.iconStartAngle + deltaAngle + 360) % 360;

    setPlaced((list) =>
      list.map((it) => (it.id === rotateId ? { ...it, angle: newAngle } : it))
    );
  };

  const stopRotate = (e) => {
    if (rotateState.current.active) {
      const didMove = rotateState.current.moved;
      try {
        if (overlayRef.current && rotateState.current.pointerId != null) {
          overlayRef.current.releasePointerCapture(rotateState.current.pointerId);
        }
      } catch {}
      rotateState.current = {
        active: false,
        id: null,
        centerX: 0,
        centerY: 0,
        pointerId: null,
        moved: false,
      };
      if (didMove) {
        justDraggedRef.current = true;
        setTimeout(() => (justDraggedRef.current = false), 0);
      }
    }
    window.removeEventListener("pointermove", rotateIcon);
    window.removeEventListener("pointerup", stopRotate);
  };

  const removeMarker = (id) => {
    setPlaced((list) => list.filter((m) => m.id !== id));
    if (rotateId === id) {
      setRotateId(null);
      if (rotationHandleRef.current) {
        rotationHandleRef.current.remove();
        rotationHandleRef.current = null;
      }
    }
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
              <div style={{ fontSize: 44, color: "#1976d2", marginBottom: 8 }}>
                ☁️
              </div>
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

              {/* Rotation handle */}
              {rotateId && placed.find((m) => m.id === rotateId && (m.typeId === "camera" || m.typeId === "projector")) && rotationHandleRef.current}

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
                      else if (m.typeId === "camera" || m.typeId === "projector") setRotateId(m.id);
                    }}
                    title={
                      rotateId === m.id
                        ? "Rotate mode: drag handle to rotate • Click to exit • Double-tap to delete"
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
