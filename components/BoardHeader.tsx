import { Layers2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  children?: React.ReactNode;
  overview?: { companies: number; remote: number };
}

export default function BoardHeader({ children, overview }: HeaderProps) {
  return (
    <header className="board-header">
      <div className="board-width board-masthead">
        <div className="board-brand">
          <h1><span className="board-mark" aria-hidden="true"><Layers2 size={21} strokeWidth={1.8} /></span>Design Jobs</h1>
          {overview && <p className="feed-info">
            <span>{overview.companies} {overview.companies === 1 ? 'company' : 'companies'}</span>
            <span aria-hidden="true">·</span>
            <span>{overview.remote} remote {overview.remote === 1 ? 'role' : 'roles'}</span>
          </p>}
        </div>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
