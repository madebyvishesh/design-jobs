'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { fields } from '@/lib/jobFields';

interface Props {
  id?: string;
  name?: string;
  allLabel?: string;
  options?: Record<string, string>;
  value: string;
  counts: Record<string, number>;
  onChange: (selection: string) => void;
}

export default function FieldPicker({
  value,
  counts,
  onChange,
  id = 'field-filter',
  name = 'Design fields',
  allLabel = 'All design fields',
  options = fields,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLFieldSetElement>(null);
  const typeahead = useRef({ term: '', time: 0 });
  const selected = value === 'all' ? [] : value.split(',');
  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options[selected[0]]
        : selected.length + ' selected';

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('input:checked, button')?.focus({ preventScroll: true });
    function outside(event: PointerEvent | FocusEvent) {
      // WebKit briefly focuses the enclosing dialog before dispatching a touch click.
      if (event.type === 'focusin' && event.target === root.current?.closest('dialog')) return;
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLFieldSetElement>) {
    const choices = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input,button'));
    const index = choices.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      choices[(index + step + choices.length) % choices.length].focus();
    } else if (/^[a-z]$/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const term =
        (now - typeahead.current.time < 650 ? typeahead.current.term : '') + event.key.toLowerCase();
      typeahead.current = { term, time: now };
      choices.find((item) => item.dataset.label?.toLowerCase().startsWith(term))?.focus();
    }
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(
      Object.keys(options)
        .filter((field) => next.has(field))
        .join(',') || 'all',
    );
  }

  return (
    <div className="filter-field field-picker" ref={root}>
      <label htmlFor={id}>{name}</label>
      <button
        type="button"
        className="board-select-trigger"
        id={id}
        ref={trigger}
        aria-label={name + ', ' + label}
        aria-expanded={open}
        aria-controls={open ? id + '-options' : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <fieldset id={id + '-options'} className="field-options" ref={menu} onKeyDown={navigate}>
          <legend className="sr-only">{name}, match any selected</legend>
          <button type="button" onClick={() => onChange('all')}>
            {allLabel} <span>{counts.all || 0}</span>
          </button>
          {Object.keys(options).map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                data-label={options[id]}
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
              />
              {options[id]}
              <span>{counts[id] || 0}</span>
            </label>
          ))}
          <button type="button" onClick={close}>
            Done
          </button>
        </fieldset>
      )}
    </div>
  );
}
