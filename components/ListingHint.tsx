'use client';

import { useEffect, useRef, type RefObject } from 'react';

export default function ListingHint({ board }: { board: RefObject<HTMLDivElement> }) {
  const hint = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anchor: HTMLElement | null = null;
    function hide() {
      if (hint.current) hint.current.hidden = true;
      anchor = null;
    }
    function inspect(event: Event) {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target === hint.current) return;
      const next = target?.closest<HTMLElement>('[data-full-text]');
      const clip = next?.querySelector<HTMLElement>('[data-clip]') ?? next;
      const box = hint.current;
      if (!next || !board.current?.contains(next) || !clip || !box || clip.scrollWidth <= clip.clientWidth) return hide();
      anchor = next;
      box.textContent = next.dataset.fullText || '';
      box.hidden = false;
      const rect = next.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8)) + 'px';
      box.style.top = (rect.bottom + box.offsetHeight < innerHeight - 8 ? rect.bottom : Math.max(4, rect.top - box.offsetHeight)) + 'px';
    }
    function leave(event: FocusEvent | PointerEvent) {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || (!anchor?.contains(next) && !hint.current?.contains(next))) hide();
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') hide(); }
    document.addEventListener('pointerover', inspect);
    document.addEventListener('focusin', inspect);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', leave);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerover', inspect);
      document.removeEventListener('focusin', inspect);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [board]);
  return <div ref={hint} className="listing-hint" aria-hidden="true" hidden />;
}
