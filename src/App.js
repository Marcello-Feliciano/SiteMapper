import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

// ---------- Cone SVG helper ----------
function ConeSVG({ id, length = 140, angle = 45, color = "rgba(0,200,0,0.35)" }) {
  const gradientId = `coneGradient-${id}`;
  const halfAngle = (angle / 2) * (Math.PI / 180);
  const x = length * Math.sin(halfAngle);
  const y = length * Math.cos(halfAngle);
  const pathData = `M0,0 L${x},${y} L${-x},${y} Z`;

  return (
    <svg
      width={length * 2}
      height={length}
      viewBox={`${-length} 0 ${length * 2} ${length}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathData} fill={`url(#${gradientId})`} />
    </svg>
  );
}

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef(null);
  const stageRef = useRef(null);
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

  // --- Placed markers ---
  const [placed, setPlaced] = useState([]);

  // --- File inputs ---
  const importInputRef = useRef(null);

  // --- Export modal ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("layout");

  // --- Drag state ---
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

  // --- Rotation state ---
  const rotateState = useRef({ active: false, id: null, pointerId: null });
  const [activeRotateId, setActiveRotateId] = useState(null);

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

  const isConeType = (typeId) => ["camera", "projector", "speaker"].includes(typeId);

  const coneColorFor = (typeId) => {
    switch (typeId) {
      case "camera":
        return "rgba(255, 0, 0, 0.35)";
      case "projector":
        return "rgba(255, 204, 0, 0.35)";
      case "speaker":
        return "rgba(255, 165, 0, 0.35)";
      default:
        return "rgba(0, 200, 0, 0.35)";
    }
  };

  // --- Import / Export handlers ---
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
            rotation: typeof m.rotation === "number" ? m.rotation : isConeType(m.typeId) ? 0 : null,
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
      alert("Unsupported file type. Use PNG/JPG or JSON.");
    }
    e.target.value = "";
  };

  const exportJSONandPNG = async (filenameBase) => {
    if (!imageSrc || !stageRef.current || !imgRef.current) return;

    const safeName = (filenameBase || "layout").trim() || "layout";
    let embeddedImage = imageSrc;
    try {
      embeddedImage = await imageToDataURL(imageSrc);
    } catch {}

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

  // --- Marker interactions ---
  const toggleSelectType = (typeId) => setSelectedTypeId((cur) => (cur === typeId ? null : typeId));

  const placeMarkerAtEvent = (e) => {
    if (!getSelectedType() || !overlayRef.current) return;
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
      },
    ]);
  };

  const beginPendingDrag = (id, e) => {
    if (!overlayRef.current) return;
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
  };

  const startRotate = (markerId, e) => {
    if (!overlayRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    setActiveRotateId(markerId);
    const pointerId = e.pointerId;
    rotateState.current = { active: true, id: markerId, pointerId };
    try { overlayRef.current.setPointerCapture(pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    // rotation & dragging handled here
    if (rotateState.current.active && overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      const marker = placed.find((m) => m.id === rotateState.current.id);
      if (marker) {
        const cx = rect.left + marker.x * rect.width;
        const cy = rect.top + marker.y * rect.height;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const angleFromX = (Math.atan2(dy, dx) * 180) / Math.PI;
        const angleUp = angleFromX - 90;
        const normalized = ((angleUp % 360) + 360) % 360;
        setPlaced((list) => list.map((m) => (m.id === marker.id ? { ...m, rotation: normalized } : m)));
      }
      return;
    }

    if (dragState.current.pending && !dragState.current.active) {
      const dxPx = Math.abs(e.clientX - dragState.current.startX);
      const dyPx = Math.abs(e.clientY - dragState.current.startY);
      if (dxPx > 4 || dyPx > 4) {
        dragState.current.active = true;
        dragState.current.moved = true;
        try { overlayRef.current.setPointerCapture(dragState.current.pointerId); } catch {}
      } else return;
    }

    if (!dragState.current.active || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragState.current.startX) / rect.width;
    const dy = (e.clientY - dragState.current.startY) / rect.height;
    const newX = dragState.current.initialX + dx;
    const newY = dragState.current.initialY + dy;
    const clampedX = Math.max(0, Math.min(1, newX));
    const clampedY = Math.max(0, Math.min(1, newY));

    setPlaced((list) => list.map((m) =>
      m.id === dragState.current.id ? { ...m, x: clampedX, y: clampedY } : m
    ));
  };

  const endDrag = (e) => {
    if (rotateState.current.active) {
      try { overlayRef.current?.releasePointerCapture(rotateState.current.pointerId); } catch {}
      rotateState.current = { active: false, id: null, pointerId: null };
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 0);
      return;
    }

    if (!dragState.current.active) {
      dragState.current = { pending: false, active: false, id: null, startX:0,startY:0,initialX:0,initialY:0,moved:false,pointerId:null };
      return;
    }

    try { overlayRef.current?.releasePointerCapture(dragState.current.pointerId); } catch {}
    dragState.current = { pending: false, active: false, id: null, startX:0,startY:0,initialX:0,initialY:0,moved:false,pointerId:null };
  };

  const removeMarker = (id) => {
    setPlaced((list) => list.filter((m) => m.id !== id));
    if (activeRotateId === id) setActiveRotateId(null);
  };

  // -------------- UI --------------
  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
      {/* ...JSX header, marker palette, main content, overlay, export modal */}
      {/* For brevity I’m omitting JSX here, it’s exactly as you provided and ends properly */}
    </div>
  );
}
