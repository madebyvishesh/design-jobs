'use client';
import { useEffect, useRef, useState } from 'react';

const key = 'design-jobs:hidden';
function read(): string[] {
  const value = JSON.parse(localStorage.getItem(key) ?? '[]');
  return Array.isArray(value) ? value.filter(id=>typeof id==='string') : [];
}
export function useHiddenRoles() {
  const [hidden,setHidden] = useState<string[]>([]);
  const memory = useRef<string[]>([]);
  const temporary = useRef(false);
  useEffect(()=>{
    function sync() {
      try { if (!temporary.current) { memory.current=read();setHidden(memory.current); } } catch { /* Use session state. */ }
    }
    function changed(e:StorageEvent) { if (e.key===key || !e.key) sync(); }
    sync();window.addEventListener('storage',changed);return ()=>window.removeEventListener('storage',changed);
  },[]);
  function setRoleHidden(id:string, hide:boolean) {
    let ids=memory.current;
    try { if (!temporary.current) ids=read(); } catch { /* Use session state. */ }
    const next=Array.from(new Set(hide?[...ids,id]:ids.filter(v=>v!==id)));
    memory.current=next;setHidden(next);
    try { localStorage.setItem(key,JSON.stringify(next)); } catch { temporary.current=true; }
  }
  return {hidden,setRoleHidden};
}
