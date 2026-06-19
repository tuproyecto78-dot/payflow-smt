"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Posición controlada (se mantiene al cerrar/reabrir). */
  position: { x: number; y: number };
  /** Se llama al terminar de arrastrar con la nueva posición. */
  onPositionChange?: (pos: { x: number; y: number }) => void;
  contentClassName?: string;
}

/**
 * Panel flotante arrastrable desde cualquier punto.
 * Renderiza SOLO el contenido (sin barra de título ni bordes cuadrados).
 * La posición es controlada por el padre para persistir al cerrar/reabrir.
 * Un botón X flotante permite cerrarlo. Se cierra también con Escape.
 */
export function FloatingPanel({
  open,
  onClose,
  title,
  children,
  position,
  onPositionChange,
  contentClassName,
}: FloatingPanelProps) {
  // Posición local durante el arrastre; se sincroniza con la prop al soltar.
  const [dragPos, setDragPos] = useState(position);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const latestPos = useRef(position);
  useEffect(() => {
    latestPos.current = dragPos;
  }, [dragPos]);

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
      setDragPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    }
    function onUp() {
      setDragging(false);
      // Notificar al padre la posición final para que persista.
      onPositionChange?.(latestPos.current);
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

  const currentPos = dragging ? dragPos : position;

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
      style={{ left: currentPos.x, top: currentPos.y, touchAction: "none" }}
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
        className="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors z-50 ring-2 ring-white/80"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
