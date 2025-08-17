import React, { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import IconMenu from "./IconMenu";

export default function App() {
  // --- Image + layout state ---
  const [imageSrc, setImageSrc] = useState(null); // dataURL of uploaded image
  const [markers, setMarkers] = useState([]); // placed icons
  const imgRef = useRef(null);
  const stageRef = useRef(null);

  // --- File import/export handlers ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/json") {
      // Import JSON with embedded image + markers
      const text = await file.text();
      const data = JSON.parse(text);
      setImageSrc(data.imageSrc);
      setMarkers(data.markers || []);
    } else if (file.type.startsWith("image/")) {
      // Import PNG or JPG
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setMarkers([]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Export both JSON and PNG at the same time
  const handleExport = async () => {
    if (!stageRef.current) return;

    // Export JSON
    const jsonData = JSON.stringify({ imageSrc, markers });
    const jsonBlob = new Blob([jsonData], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement("a");
    jsonLink.href = jsonUrl;
    jsonLink.download = "layout.json";
    jsonLink.click();

    // Export PNG
    const canvas = await html2canvas(stageRef.current);
    const pngUrl = canvas.toDataURL("image/png");
    const pngLink = document.createElement("a");
    pngLink.href = pngUrl;
    pngLink.download = "layout.png";
    pngLink.click();
  };

  // --- Marker handling ---
  const handleAddMarker = (icon) => {
    setMarkers((prev) => [
      ...prev,
      { id: Date.now(), src: icon.src, x: 100, y: 100 },
    ]);
  };

  const handleDragMarker = (id, e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setMarkers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, x: offsetX, y: offsetY } : m))
    );
  };

  // --- Base marker definitions (icon options) ---
  const baseMarkerTypes = [
    { id: "camera", src: "/icons/camera.png" },
    { id: "door", src: "/icons/door.png" },
    { id: "tv", src: "/icons/tv.png" },
    { id: "wifi", src: "/icons/wifi.png" },
  ];

  // Preload icons so they’re consistent size before rendering
  useEffect(() => {
    baseMarkerTypes.forEach((marker) => {
      const img = new Image();
      img.src = marker.src;
    });
  }, [baseMarkerTypes]); // ✅ FIXED: Added dependency

  return (
    <div className="app">
      {/* Sidebar with icon grid */}
      <aside className="sidebar">
        <IconMenu onSelect={handleAddMarker} markerTypes={baseMarkerTypes} />
      </aside>

      {/* Main workspace */}
      <main className="workspace">
        <div className="controls">
          <input type="file" accept=".json,image/*" onChange={handleFileChange} />
          <button onClick={handleExport}>Export (JSON + PNG)</button>
        </div>

        <div className="floorplan" ref={stageRef} style={{ position: "relative" }}>
          {imageSrc && (
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Floorplan"
              className="floorplan-image"
              style={{ maxWidth: "100%", display: "block" }}
            />
          )}

          {/* Render placed markers */}
          {markers.map((marker) => (
            <img
              key={marker.id}
              src={marker.src}
              alt="marker"
              className="marker"
              draggable
              onDragEnd={(e) => handleDragMarker(marker.id, e)}
              style={{
                position: "absolute",
                left: marker.x,
                top: marker.y,
                width: 40,
                height: 40,
                objectFit: "contain",
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
