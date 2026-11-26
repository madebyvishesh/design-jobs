import ThemeToggle from './ThemeToggle';

export default function BoardHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="board-header">
      <div className="board-width board-masthead">
        <h1>Design Jobs</h1>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
