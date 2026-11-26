'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { PanelsTopLeft } from 'lucide-react';

export default function ViewOptions({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  const root = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent | FocusEvent) {
      const panel = root.current;
      if (panel?.open && !panel.contains(event.target as Node)) panel.open = false;
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, []);

  return (
    <details
      className="view-options"
      ref={root}
      onToggle={event => { if (event.currentTarget.open) onOpen(); }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.open) return;
        if (event.currentTarget.querySelector('[role="listbox"]')) return;
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }}
    >
      <summary className="board-control" aria-label="View options" title="View options">
        <PanelsTopLeft size={16} aria-hidden="true" /><span className="filter-label">View</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}
