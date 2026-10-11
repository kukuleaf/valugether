import Link from 'next/link';
import { LogoutButton } from './LogoutButton';
const links = [
  ['/dashboard', 'Dashboard'],
  ['/tolerances', 'Tolerance'],
  ['/providers', 'Providers'],
  ['/batches', 'Batches'],
  ['/rankings', 'Excel Export'],
  ['/strategies', '전략 관리'],
  ['/notices', '공지 관리'],
  ['/logs', 'Audit Logs'],
  ['/terms', '약관 관리'],
];
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">가치보는주식</div>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
