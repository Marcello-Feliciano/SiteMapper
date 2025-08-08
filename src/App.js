import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

const MARKER_TYPES = [
    { type: "camera", emoji: "📷" },
    { type: "door", emoji: "🚪" },
    { type: "cardreader", emoji: "💳" },
    { type: "tv", emoji: "📺" },
    { type: "wifi", emoji: "📶" },
    { type: "projector", emoji: "📽️" },
];

function App() {
    const [imageSrc, setImageSrc] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFilename, setExportFilename] = useState("layout");

    const containerRef = useRef(null);

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

    const exportAll = async (filename) => {
        if (!imageSrc || !containerRef.current) return;

        const name = filename || "layout";

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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <div className="flex items-center">
                    <button className="mr-4 text-white hover:text-gray-200">
                        ≡
                    </button>
                    <h1 className="text-xl font-semibold">JobSite Marker</h1>
                </div>
                <button
                    className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-gray-100"
                    onClick={() => document.getElementById('fileInput').click()}
                >
                    Import
                </button>
            </header>

            {/* Main Content */}
            <main className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                {!imageSrc && (
                    <div className="text-center bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <div className="mb-4">
                            <svg
                                className="mx-auto h-12 w-12 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l-4-4m4 4l4-4"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Upload Floorplan
                        </h2>
                        <p className="text-gray-600 mb-4">
                            Upload a building layout or floorplan to start adding markers
                        </p>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,application/json"
                                onChange={handleImageUpload}
                                className="hidden"
                                id="fileInput"
                            />
                            <label
                                htmlFor="fileInput"
                                className="cursor-pointer text-gray-500 hover:text-gray-700"
                            >
                                Tap to select file or drag & drop
                                <br />
                                <span className="text-sm text-gray-400">
                                    PNG, JPG, PDF supported
                                </span>
                            </label>
                        </div>
                        <div className="mt-6 text-gray-500">
                            <svg
                                className="mx-auto h-6 w-6 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                />
                            </svg>
                            <p className="text-sm">No projects yet</p>
                            <p className="text-sm">Upload a floorplan to get started</p>
                        </div>
                    </div>
                )}

                {imageSrc && (
                    <div className="p-5 max-w-7xl mx-auto">
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,application/json"
                                onChange={handleImageUpload}
                                className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <button
                                onClick={() => setShowExportModal(true)}
                                disabled={!imageSrc}
                                className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                aria-label="Export JSON + PNG"
                            >
                                Export JSON + PNG
                            </button>
                        </div>

                        <div className="mb-4">
                            <strong className="text-lg text-gray-700">
                                Select Marker Type:
                            </strong>
                            <div className="flex gap-2 mt-2">
                                {MARKER_TYPES.map(({ type, emoji }) => (
                                    <button
                                        key={type}
                                        onClick={() =>
                                            setSelectedType((cur) =>
                                                cur === type ? null : type
                                            )
                                        }
                                        className={`text-2xl p-2 rounded ${
                                            selectedType === type
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-200 text-black"
                                        } hover:bg-blue-500 hover:text-white transition-colors`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div
                            ref={containerRef}
                            onClick={handleImageClick}
                            className="relative inline-block border-2 border-gray-800 max-w-full"
                        >
                            <img
                                src={imageSrc}
                                alt="Floorplan"
                                className="block w-full h-auto"
                                draggable={false}
                            />
                            {markers.map(({ id, type, x, y }) => {
                                const emoji =
                                    MARKER_TYPES.find((m) => m.type === type)?.emoji ||
                                    "❓";
                                return (
                                    <div
                                        key={id}
                                        draggable
                                        onDrag={(e) => e.preventDefault()}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("text/plain", id);
                                        }}
                                        onDragEnd={(e) =>
                                            dragMarker(id, e.clientX, e.clientY)
                                        }
                                        className="absolute text-3xl cursor-grab select-none"
                                        style={{
                                            left: `${x * 100}%`,
                                            top: `${y * 100}%`,
                                            transform: "translate(-50%, -50%)",
                                        }}
                                        title={type}
                                    >
                                        {emoji}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showExportModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-5 rounded-lg w-80 shadow-xl flex flex-col gap-3">
                            <label
                                htmlFor="filenameInput"
                                className="font-bold text-gray-700"
                            >
                                Enter filename:
                            </label>
                            <input
                                id="filenameInput"
                                type="text"
                                value={exportFilename}
                                onChange={(e) => setExportFilename(e.target.value)}
                                autoFocus
                                className="p-2 border rounded text-lg"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="py-2 px-4 bg-gray-200 rounded hover:bg-gray-300"
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
                                    className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
