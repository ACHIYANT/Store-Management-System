import { useCallback, useEffect, useRef, useState } from "react";

const INTERACTIVE_SELECTOR =
  "input, textarea, select, button, a, label, [role='button'], [contenteditable='true'], [data-no-drag-scroll='true']";

export default function useDragToScroll({ threshold = 6 } = {}) {
  const containerRef = useRef(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    prevUserSelect: "",
    moveHandler: null,
    upHandler: null,
  });
  const [isDragging, setIsDragging] = useState(false);

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state.active && !state.moved) return;

    state.active = false;
    state.moved = false;
    setIsDragging(false);

    document.body.style.userSelect = state.prevUserSelect || "";
    if (state.moveHandler) {
      window.removeEventListener("mousemove", state.moveHandler);
    }
    if (state.upHandler) {
      window.removeEventListener("mouseup", state.upHandler);
    }
    state.moveHandler = null;
    state.upHandler = null;
  }, []);

  const onMouseDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.(INTERACTIVE_SELECTOR)) return;

      const host = containerRef.current;
      if (!host) return;

      dragRef.current = {
        active: true,
        moved: false,
        startX: event.clientX ?? 0,
        startY: event.clientY ?? 0,
        startScrollLeft: host.scrollLeft,
        startScrollTop: host.scrollTop,
        prevUserSelect: document.body.style.userSelect || "",
        moveHandler: null,
        upHandler: null,
      };

      const handleMove = (moveEvent) => {
        const currentHost = containerRef.current;
        const state = dragRef.current;
        if (!currentHost || !state.active) return;

        const dx = (moveEvent.clientX ?? 0) - state.startX;
        const dy = (moveEvent.clientY ?? 0) - state.startY;

        if (!state.moved) {
          if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
          state.moved = true;
          setIsDragging(true);
        }

        moveEvent.preventDefault();
        currentHost.scrollLeft = state.startScrollLeft - dx;
        currentHost.scrollTop = state.startScrollTop - dy;
      };

      const handleUp = () => {
        endDrag();
      };

      dragRef.current.moveHandler = handleMove;
      dragRef.current.upHandler = handleUp;
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMove, { passive: false });
      window.addEventListener("mouseup", handleUp);
    },
    [endDrag, threshold],
  );

  useEffect(
    () => () => {
      endDrag();
    },
    [endDrag],
  );

  return { containerRef, onMouseDown, isDragging };
}
