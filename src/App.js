import React, { useRef, useState, useEffect } from "react";

function App() {
  const [image, setImage] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load image or JSON from file input
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.type === "application/json") {
      reader.onload = (event) => {
        const jsonData = JSON.parse(event.target.result);
        setImage(jsonData.image);
        setMarkers(jsonData.markers || []);
      };
      reader.readAsText(file);
    } else if (file.type.startsWith("image/")) {
      reader.onload = (event) => {
        setImage(event.target.result);
        setMarkers([]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add marker to click position
  const handleCanvasClick = (e) => {
    if (!selectedIcon) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMarkers([...markers, { type: selectedIcon, x, y }]);
  };

  // Handle selecting/deselecting icons
  const toggleIconSelection = (icon) => {
    setSelectedIcon((prev) => (prev === icon ? null : icon));
  };

  // Export JSON & PNG together
  const handleExport = () => {
    if (!image) return;

    // Export JSON
    const jsonData = {
      image,
      markers,
    };
    const jsonBlob = new Blob([JSON.stringify(jsonData)], {
      type: "application/json",
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement("a");
    jsonLink.href = jsonUrl;
    jsonLink.download = "layout.json";
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    // Export PNG
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      markers.forEach((marker) => {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });

      const pngUrl = canvas.toDataURL("image/png");
      const pngLink = document.createElement("a");
      pngLink.href = pngUrl;
      pngLink.download = "layout.png";
      pngLink.click();
    };
  };

  return (
    <div style={{ padding: "10px" }}>
      {/* Import Button */}
      <input
        type="file"
        accept=".png, .jpg, .jpeg, .json"
        ref={fileInputRef}
        onChange={handleImport}
      />

      {/* Export Button directly under Import */}
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleExport}>Export JSON & PNG</button>
      </div>

      {/* Icon Toolbar */}
      <div style={{ marginTop: "10px" }}>
        {["📷", "🔒", "📡", "💡"].map((icon) => (
          <button
            key={icon}
            style={{
              background: selectedIcon === icon ? "lightblue" : "white",
            }}
            onClick={() => toggleIconSelection(icon)}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ marginTop: "10px" }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ border: "1px solid black" }}
        />
      </div>
    </div>
  );
}

export default App;
