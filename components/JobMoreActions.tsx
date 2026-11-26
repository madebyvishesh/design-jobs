'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Ellipsis, EyeOff, Undo2 } from 'lucide-react';

type Props = {
  hidden: boolean;
  copied: boolean;
  copy: (trigger: HTMLButtonElement) => void;
  toggleHidden: () => void;
};

export default function JobMoreActions({ hidden, copied, copy, toggleHidden }: Props) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const keyboardOpen = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    if (keyboardOpen.current) firstAction.current?.focus();
    function dismiss(event: Event) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [open]);

  return <div className="detail-more" ref={root} onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button type="button" ref={trigger} aria-label="More job actions" title="More job actions"
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={event => {
        keyboardOpen.current = event.detail === 0;
        event.currentTarget.focus({ preventScroll: true });
        setAbove(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 112);
        setOpen(!open);
      }}>{copied ? <Check size={17}/> : <Ellipsis size={18}/>}</button>
    {open && <div id={id} className="detail-more-options" data-above={above} role="group" aria-label="More job actions">
      <button ref={firstAction} onClick={() => {
        const button = trigger.current!;
        button.focus();
        setOpen(false);
        copy(button);
      }}><Copy size={15}/>Copy application link</button>
      <button onClick={toggleHidden}>{hidden ? <Undo2 size={15}/> : <EyeOff size={15}/>}
        {hidden ? 'Restore role' : 'Hide this role'}</button>
    </div>}
  </div>;
}
