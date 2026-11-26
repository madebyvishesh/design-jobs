import { Layers2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function BoardHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="board-header">
      <div className="board-width board-masthead">
        <h1><span className="board-mark" aria-hidden="true"><Layers2 size={21} strokeWidth={1.8} /></span>Design Jobs</h1>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
