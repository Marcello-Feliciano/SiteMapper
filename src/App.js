import React, { useState, useRef } from "react";

export default function App() {
  const [image, setImage] = useState(null);
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type.includes("image") || file.type.includes("pdf"))) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.includes("image") || file.type.includes("pdf"))) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f8f9fa", height: "100vh" }}>
      {/* Top Bar */}
      <div
        style={{
          background: "#1976d2",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: "56px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>JobSite Marker</div>
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            background: "white",
            color: "#1976d2",
            border: "none",
            borderRadius: "6px",
            padding: "6px 16px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          ⬆ Import
        </button>
        <input
          type="file"
          accept="image/*,.pdf"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
        {!image ? (
          <div style={{ textAlign: "center" }}>
            {/* Upload Card */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{
                background: "white",
                borderRadius: "8px",
                padding: "30px",
                width: "350px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                marginBottom: "30px"
              }}
            >
              <div style={{ fontSize: "40px", color: "#1976d2" }}>☁️</div>
              <h3>Upload Floorplan</h3>
              <p style={{ color: "#666", fontSize: "14px" }}>
                Upload a building layout or floorplan to start adding markers
              </p>
              <div
                onClick={() => fileInputRef.current.click()}
                style={{
                  border: "2px dashed #ccc",
                  borderRadius: "6px",
                  padding: "20px",
                  cursor: "pointer",
                  marginTop: "10px",
                  color: "#777",
                  fontSize: "14px"
                }}
              >
                📄 Tap to select file or drag & drop
                <br />
                <span style={{ fontSize: "12px" }}>PNG, JPG, PDF supported</span>
              </div>
            </div>

            {/* No Projects Message */}
            <div style={{ color: "#888", fontSize: "14px" }}>
              <div style={{ fontSize: "30px" }}>🏢</div>
              No projects yet
              <br />
              <span style={{ fontSize: "12px" }}>
                Upload a floorplan to get started
              </span>
            </div>
          </div>
        ) : (
          // Show uploaded image
          <div style={{ maxWidth: "90%", maxHeight: "80vh" }}>
            {image.endsWith(".pdf") ? (
              <p style={{ color: "#555" }}>PDF preview not supported, file uploaded successfully.</p>
            ) : (
              <img
                src={image}
                alt="Uploaded Floorplan"
                style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
