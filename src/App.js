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
    overflow: "hidden",          // <— important, container for pan
    touchAction: "auto",
  }}
>
  <TransformWrapper
    minScale={0.5}
    maxScale={5}
    wheel={{ step: 0.2 }}
    doubleClick={{ disabled: true }}
    pinch={{ step: 5 }}
    panning={{ velocityDisabled: true }}
  >
    <TransformComponent wrapperStyle={{ width: "100%" }}>
      {/* Your existing image + overlay wrapper, unchanged */}
      <div
        ref={imageWrapRef}
        style={{
          position: "relative",
          display: "inline-block",
          width: "100%",
          touchAction: "none", // allow markers drag and pinch gestures
        }}
      >
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

        {/* Overlay (unchanged) */}
        <div
          ref={overlayRef}
          onClick={placeMarkerAtEvent}
          onPointerDown={(e) => {
            const handleEl = e.target.closest?.("[data-rotate-handle]");
            if (handleEl) {
              startRotate(handleEl.getAttribute("data-marker-id"), e);
              return;
            }
            const marker = e.target.closest?.("[data-marker-id]");
            if (marker) beginPendingDrag(marker.dataset.markerId, e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          {placed.map((m) => {
            const type = markerTypes.find((t) => t.id === m.typeId);
            const showCone = isConeType(m.typeId);
            const rotation = typeof m.rotation === "number" ? m.rotation : 0;

            return (
              <div
                key={m.id}
                data-marker-id={m.id}
                onDoubleClick={() => removeMarker(m.id)}
                onClick={(e) => {
                  if (!showCone) return;
                  if (justDraggedRef.current) return;
                  e.stopPropagation();
                  setActiveRotateId((cur) => (cur === m.id ? null : m.id));
                }}
                style={{
                  position: "absolute",
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                  background: "transparent",
                  padding: 0,
                  boxShadow: "none",
                }}
                title={
                  showCone
                    ? "Click to rotate • Drag to move • Double-click to delete"
                    : "Drag to move • Double-click to delete"
                }
              >
                {/* Cone behind icon */}
                {showCone && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
                      transformOrigin: "50% 50%",
                      pointerEvents: "none",
                    }}
                  >
                    <ConeSVG length={140} angle={45} color={coneColorFor(m.typeId)} />
                  </div>
                )}

                {/* Icon */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  {type?.iconSrc && (
                    <img
                      src={type.iconSrc}
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
                  )}
                </div>

                {/* Rotation handle */}
                {showCone && activeRotateId === m.id && (
                  <div
                    data-rotate-handle
                    data-marker-id={m.id}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%,-50%) rotate(${rotation}deg) translate(0, -70px)`,
                      transformOrigin: "50% 50%}",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid #1976d2",
                      background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                      cursor: "grab",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TransformComponent>
  </TransformWrapper>
</div>
export default App;
