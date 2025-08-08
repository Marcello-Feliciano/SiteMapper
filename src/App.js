import React, { useState, useRef } from "react";
import html2canvas from "html2canvas";

const MARKER_TYPES = [
    { type: "camera", emoji: "📷" },
    { type: "door", emoji: "🚪" },
    { type: "cardreader", emoji: "💳" },
    { type: "tv", emoji: "📺" },
    { type: "wifi", emoji: "📶" },
    { type: "projector", emoji: "📽️" },
];

export default function App() {
    const [imageSrc, setImageSrc] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [selectedType, setSelectedType] = useState(null);

    // Modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFilename, setExportFilename] = useState("layout");

    const containerRef = useRef(null);

    // Add marker on click
    const handleImageClick = (e) => {
        if (!selectedType || !containerRef.current) return;

        const img = containerRef.current.querySelector("img");
        if (!img) return;

        const rect = img.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const x = offsetX / rect.width;
        const y = offsetY / rect.height;

        setMarkers((m) => [...m, { id: Date.now(), type: selectedType, x, y }]);
    };

    // Drag marker
    const dragMarker = (id, clientX, clientY) => {
        if (!containerRef.current) return;

        const img = containerRef.current.querySelector("img");
        if (!img) return;

        const rect = img.getBoundingClientRect();

        let x = (clientX - rect.left) / rect.width;
        let y = (clientY - rect.top) / rect.height;

        x = Math.min(Math.max(x, 0), 1);
        y = Math.min(Math.max(y, 0), 1);

        setMarkers((m) =>
            m.map((marker) => (marker.id === id ? { ...marker, x, y } : marker))
        );
    };

    // Convert image to data URL for JSON export
    const imageToDataURL = (src) =>
        new Promise((resolve, reject) => {
            if (!src) return reject(new Error("No image source"));
            if (src.startsWith("data:")) return resolve(src);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = src;
        });

    // Export function with filename parameter
    const exportAll = async (filename) => {
        if (!imageSrc || !containerRef.current) return;

        const name = filename || "layout";

        // Export JSON
        let imageData;
        try {
            imageData = imageSrc.startsWith("data:")
                ? imageSrc
                : await imageToDataURL(imageSrc);
        } catch {
            alert("Failed to prepare image for JSON export");
            return;
        }

        const data = { imageData, markers };
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const a = document.createElement("a");
        a.href = jsonUrl;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(jsonUrl);

        // Export PNG
        const container = containerRef.current;
        const canvas = await html2canvas(container, {
            backgroundColor: null,
            useCORS: true,
            scale: 1,
        });

        const pngLink = document.createElement("a");
        pngLink.download = `${name}.png`;
        pngLink.href = canvas.toDataURL();
        pngLink.click();
    };

    // Handle file input (image or JSON)
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === "application/json") {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.imageData && Array.isArray(data.markers)) {
                        setImageSrc(data.imageData);
                        setMarkers(data.markers);
                    } else {
                        alert("Invalid JSON format");
                    }
                } catch {
                    alert("Failed to read JSON file");
                }
            };
            reader.readAsText(file);
        } else if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setImageSrc(url);
            setMarkers([]);
        } else {
            alert("Unsupported file type");
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <h1>SiteMapper</h1>

            {/* Import + Export row */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 10,
                    flexWrap: "wrap",
                }}
            >
                <input
                    type="file"
                    accept="image/png,image/jpeg,application/json"
                    onChange={handleImageUpload}
                />
                <button
                    onClick={() => setShowExportModal(true)}
                    disabled={!imageSrc}
                    aria-label="Export JSON + PNG"
                >
                    Export JSON + PNG
                </button>
            </div>

            {/* Marker selector */}
            <div style={{ marginBottom: 10 }}>
                <strong>Select Marker Type: </strong>
                {MARKER_TYPES.map(({ type, emoji }) => (
                    <button
                        key={type}
                        onClick={() => setSelectedType((cur) => (cur === type ? null : type))}
                        style={{
                            fontSize: 24,
                            marginRight: 8,
                            background: selectedType === type ? "#2e86de" : "#ddd",
                            color: selectedType === type ? "white" : "black",
                            border: "none",
                            padding: "4px 8px",
                            cursor: "pointer",
                        }}
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Image + markers */}
            {imageSrc ? (
                <div
                    ref={containerRef}
                    onClick={handleImageClick}
                    style={{
                        position: "relative",
                        display: "inline-block",
                        border: "2px solid #333",
                        width: "100%",
                        maxWidth: "1000px",
                    }}
                >
                    <img
                        src={imageSrc}
                        alt="Floorplan"
                        style={{ display: "block", width: "100%", height: "auto" }}
                        draggable={false}
                    />
                    {markers.map(({ id, type, x, y }) => {
                        const emoji = MARKER_TYPES.find((m) => m.type === type)?.emoji || "❓";
                        return (
                            <div
                                key={id}
                                draggable
                                onDrag={(e) => e.preventDefault()}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", id);
                                }}
                                onDragEnd={(e) => dragMarker(id, e.clientX, e.clientY)}
                                style={{
                                    position: "absolute",
                                    left: `${x * 100}%`,
                                    top: `${y * 100}%`,
                                    fontSize: 30,
                                    cursor: "grab",
                                    userSelect: "none",
                                    transform: "translate(-50%, -50%)",
                                }}
                                title={type}
                            >
                                {emoji}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p>Please upload a floorplan image to start.</p>
            )}

            {/* Export filename modal */}
            {showExportModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "white",
                            padding: 20,
                            borderRadius: 8,
                            width: 300,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        <label htmlFor="filenameInput" style={{ fontWeight: "bold" }}>
                            Enter filename:
                        </label>
                        <input
                            id="filenameInput"
                            type="text"
                            value={exportFilename}
                            onChange={(e) => setExportFilename(e.target.value)}
                            autoFocus
                            style={{ padding: 8, fontSize: 16 }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button
                                onClick={() => setShowExportModal(false)}
                                style={{ padding: "6px 12px" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!exportFilename.trim()) {
                                        alert("Please enter a valid filename");
                                        return;
                                    }
                                    exportAll(exportFilename.trim());
                                    setShowExportModal(false);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#2e86de",
                                    color: "white",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
