"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  contentClassName?: string;
}

/**
 * Panel flotante arrastrable desde cualquier punto.
 * Renderiza SOLO el contenido (sin barra de título ni bordes cuadrados).
 * Un botón X flotante permite cerrarlo. Se cierra también con Escape.
 */
export function FloatingPanel({
  open,
  onClose,
  title,
  children,
  initialPosition,
  contentClassName,
}: FloatingPanelProps) {
  const [pos, setPos] = useState(initialPosition ?? { x: 120, y: 120 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (!open) return null;

  function onDragStart(e: React.MouseEvent) {
    // No arrastrar si se hace clic en un elemento interactivo (botón, input, link)
    // o en un área con scroll (el chat de mensajes).
    const target = e.target as HTMLElement;
    if (
      target.closest("button, a, input, textarea, select, [data-no-drag]")
    ) {
      return;
    }
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragging(true);
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      onMouseDown={onDragStart}
      className={cn(
        "fixed z-50 select-none cursor-grab",
        dragging && "cursor-grabbing"
      )}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      {children}
      {/* Botón de cerrar flotante (no arrastra al hacer clic) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Cerrar (Esc)"
        aria-label="Cerrar simulador"
        className="absolute -top-2 -right-2 size-7 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors z-50 ring-2 ring-white/80"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
