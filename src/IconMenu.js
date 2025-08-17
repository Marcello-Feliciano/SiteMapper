// IconMenu.jsx
import React from "react";

export default function IconMenu({ onSelect }) {
  const icons = [
    { id: "camera", src: "/icons/camera.png" },
    { id: "doorlock", src: "/icons/doorlock.png" },
    { id: "tv", src: "/icons/tv.png" },
    { id: "rack", src: "/icons/computer_rack.png" },
  ];

  return (
    <div className="icon-grid">
      {icons.map((icon) => (
        <img
          key={icon.id}
          src={icon.src}
          alt={icon.id}
          className="icon"
          onClick={() => onSelect(icon)}
        />
      ))}
    </div>
  );
}
