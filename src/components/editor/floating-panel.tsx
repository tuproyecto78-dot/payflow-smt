"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  /** Clase de ancho/alamaño del contenido */
  contentClassName?: string;
}

/**
 * Panel flotante arrastrable que se puede mover dentro de la plataforma.
 * Se cierra con el botón X o con la tecla Escape.
 */
export function FloatingPanel({
  open,
  onClose,
  title,
  children,
  initialPosition,
  contentClassName,
}: FloatingPanelProps) {
  const [pos, setPos] = useState(
    initialPosition ?? { x: 120, y: 120 }
  );
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
      className={cn(
        "fixed z-50 select-none",
        dragging && "cursor-grabbing"
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Barra de arrastre */}
      <div
        onMouseDown={onDragStart}
        className={cn(
          "flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-t-lg cursor-grab shadow-lg",
          dragging && "cursor-grabbing"
        )}
      >
        <GripHorizontal className="size-3.5 opacity-60" />
        {title && (
          <span className="text-xs font-medium flex-1">{title}</span>
        )}
        <button
          onClick={onClose}
          className="size-5 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
          title="Cerrar"
        >
          <X className="size-3" />
        </button>
      </div>
      <div
        className={cn(
          "bg-slate-900 rounded-b-lg shadow-2xl p-1",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
