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
