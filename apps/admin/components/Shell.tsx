import Link from 'next/link';
const links = [
  ['/dashboard', 'Dashboard'],
  ['/tolerances', 'Tolerance'],
  ['/providers', 'Providers'],
  ['/batches', 'Batches'],
  ['/logs', 'Audit Logs'],
  ['/terms', '약관 관리'],
];
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">바른주식 밸류</div>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
