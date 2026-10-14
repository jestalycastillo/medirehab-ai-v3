"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export function PortalActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const positionMenu = () => {
    const menu = ref.current?.querySelector<HTMLElement>(".portal-action-menu-content");
    if (!ref.current?.open || !menu) return;
    menu.style.transform = "";
    const bounds = menu.getBoundingClientRect();
    const offset = bounds.left < 8 ? 8 - bounds.left : Math.min(0, window.innerWidth - 8 - bounds.right);
    menu.style.transform = `translateX(${offset}px)`;
  };
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", positionMenu);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", positionMenu);
    };
  }, []);
  return (
    <details ref={ref} className="portal-action-menu" onToggle={positionMenu}>
      <summary aria-label={label}><MoreHorizontal size={18} aria-hidden="true" /><span>More</span></summary>
      <div className="portal-action-menu-content" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a") && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}>{children}</div>
    </details>
  );
}
