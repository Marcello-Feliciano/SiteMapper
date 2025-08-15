const fileInput = document.getElementById("fileInput");
const exportButton = document.getElementById("exportButton");
const iconButtons = document.querySelectorAll(".icon-btn");
const imageCanvas = document.getElementById("imageCanvas");
const ctx = imageCanvas.getContext("2d");

let backgroundImage = null;
let markers = [];
let selectedMarkerIndex = null;

// Load saved markers from localStorage
if (localStorage.getItem("markersData")) {
    const savedData = JSON.parse(localStorage.getItem("markersData"));
    backgroundImage = new Image();
    backgroundImage.onload = () => {
        draw();
    };
    backgroundImage.src = savedData.background;
    markers = savedData.markers;
}

// Add marker
iconButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const iconSrc = btn.getAttribute("data-icon");
        markers.push({
            type: iconSrc,
            x: imageCanvas.width / 2,
            y: imageCanvas.height / 2,
            rotation: 0,
            showCone: iconSrc.includes("camera") || iconSrc.includes("projector"),
        });
        saveMarkers();
        draw();
    });
});

// Handle file import
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith(".json")) {
        reader.onload = (event) => {
            const jsonData = JSON.parse(event.target.result);
            backgroundImage = new Image();
            backgroundImage.onload = () => {
                markers = jsonData.markers || [];
                saveMarkers();
                draw();
            };
            backgroundImage.src = jsonData.background;
        };
        reader.readAsText(file);
    } else if (file.type.startsWith("image/")) {
        reader.onload = (event) => {
            backgroundImage = new Image();
            backgroundImage.onload = () => {
                markers = [];
                saveMarkers();
                draw();
            };
            backgroundImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Handle export (PNG + JSON)
exportButton.addEventListener("click", () => {
    const exportData = {
        background: backgroundImage ? backgroundImage.src : "",
        markers,
    };
    const jsonBlob = new Blob([JSON.stringify(exportData)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);

    const jsonLink = document.createElement("a");
    jsonLink.href = jsonUrl;
    jsonLink.download = "layout.json";
    jsonLink.click();

    const pngUrl = imageCanvas.toDataURL("image/png");
    const pngLink = document.createElement("a");
    pngLink.href = pngUrl;
    pngLink.download = "layout.png";
    pngLink.click();
});

// Mouse/touch dragging
let isDragging = false;
let isRotating = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

imageCanvas.addEventListener("mousedown", startInteraction);
imageCanvas.addEventListener("touchstart", startInteraction);
imageCanvas.addEventListener("mousemove", moveInteraction);
imageCanvas.addEventListener("touchmove", moveInteraction);
imageCanvas.addEventListener("mouseup", endInteraction);
imageCanvas.addEventListener("touchend", endInteraction);

function startInteraction(e) {
    const pos = getMousePos(e);
    selectedMarkerIndex = getMarkerAtPos(pos.x, pos.y);

    if (selectedMarkerIndex !== null) {
        const marker = markers[selectedMarkerIndex];
        if (isOnRotationHandle(marker, pos.x, pos.y)) {
            isRotating = true;
        } else {
            isDragging = true;
            dragOffsetX = pos.x - marker.x;
            dragOffsetY = pos.y - marker.y;
        }
    }
}

function moveInteraction(e) {
    if (selectedMarkerIndex === null) return;
    const pos = getMousePos(e);
    const marker = markers[selectedMarkerIndex];

    if (isDragging) {
        marker.x = pos.x - dragOffsetX;
        marker.y = pos.y - dragOffsetY;
        draw();
    } else if (isRotating) {
        const dx = pos.x - marker.x;
        const dy = pos.y - marker.y;
        marker.rotation = Math.atan2(dy, dx);
        draw();
    }
}

function endInteraction() {
    if (isDragging || isRotating) {
        saveMarkers();
    }
    isDragging = false;
    isRotating = false;
}

// Double click/tap delete
let lastTapTime = 0;
imageCanvas.addEventListener("click", (e) => {
    const now = Date.now();
    if (now - lastTapTime < 300) {
        const pos = getMousePos(e);
        const idx = getMarkerAtPos(pos.x, pos.y);
        if (idx !== null) {
            markers.splice(idx, 1);
            saveMarkers();
            draw();
        }
    }
    lastTapTime = now;
});

function getMousePos(evt) {
    const rect = imageCanvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
        x: (clientX - rect.left) * (imageCanvas.width / rect.width),
        y: (clientY - rect.top) * (imageCanvas.height / rect.height),
    };
}

function getMarkerAtPos(x, y) {
    for (let i = markers.length - 1; i >= 0; i--) {
        const marker = markers[i];
        const img = new Image();
        img.src = marker.type;
        const size = 40;
        if (x >= marker.x - size / 2 && x <= marker.x + size / 2 &&
            y >= marker.y - size / 2 && y <= marker.y + size / 2) {
            return i;
        }
    }
    return null;
}

function isOnRotationHandle(marker, x, y) {
    const handleDistance = 30;
    const handleX = marker.x + Math.cos(marker.rotation) * handleDistance;
    const handleY = marker.y + Math.sin(marker.rotation) * handleDistance;
    return Math.hypot(x - handleX, y - handleY) < 10;
}

function saveMarkers() {
    localStorage.setItem("markersData", JSON.stringify({
        background: backgroundImage ? backgroundImage.src : "",
        markers
    }));
}

function draw() {
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, imageCanvas.width, imageCanvas.height);
    }
    markers.forEach((marker, i) => {
        const img = new Image();
        img.src = marker.type;
        ctx.save();
        ctx.translate(marker.x, marker.y);
        ctx.rotate(marker.rotation);
        ctx.drawImage(img, -20, -20, 40, 40);
        ctx.restore();

        if (marker.showCone) {
            drawCone(marker);
            drawRotationHandle(marker);
        }
    });
}

function drawCone(marker) {
    const coneLength = 50;
    const coneAngle = Math.PI / 4;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(marker.rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(coneLength, -coneLength * Math.tan(coneAngle / 2));
    ctx.lineTo(coneLength, coneLength * Math.tan(coneAngle / 2));
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
    ctx.fill();
    ctx.restore();
}

function drawRotationHandle(marker) {
    const handleDistance = 30;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(marker.rotation);
    ctx.beginPath();
    ctx.arc(handleDistance, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.restore();
}
