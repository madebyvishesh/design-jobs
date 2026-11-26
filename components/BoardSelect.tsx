'use client';

import { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export default function BoardSelect({ id, label, value, options, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || !content?.isConnected) return;
    const background: HTMLElement[] = [];
    for (let node: HTMLElement | null = content; node?.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) background.push(sibling);
      }
      if (node.parentElement === document.body) break;
    }
    for (const element of background) element.inert = true;
    return () => { for (const element of background) element.inert = false; };
  }, [open, content]);
  return <div className="filter-field">
    <label htmlFor={id} id={id + '-label'}>{label}</label>
    <Select.Root open={open} onOpenChange={setOpen} value={value} onValueChange={onChange}>
      <Select.Trigger id={id} className="board-select-trigger" aria-labelledby={id + '-label ' + id + '-value'}>
        <span id={id + '-value'}>{options.find(item => item.value === value)?.label ?? placeholder}</span>
        <Select.Icon asChild><ChevronDown size={15} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Content ref={setContent} position="popper" sideOffset={5} collisionPadding={12} className="board-menu" aria-labelledby={id + '-label'}>
        <Select.ScrollUpButton className="board-menu-scroll"><ChevronUp size={14} aria-hidden="true" /></Select.ScrollUpButton>
        <Select.Viewport className="board-menu-items">
          {options.map((item, i) => <Select.Item tabIndex={item.value === value || (!value && i === 0) ? 0 : -1} key={item.value} value={item.value} textValue={item.label} className="board-menu-item">
            <Select.ItemText>{item.label}</Select.ItemText>
            <Select.ItemIndicator><Check size={15} aria-hidden="true" /></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className="board-menu-scroll"><ChevronDown size={14} aria-hidden="true" /></Select.ScrollDownButton>
      </Select.Content>
    </Select.Root>
  </div>;
}
