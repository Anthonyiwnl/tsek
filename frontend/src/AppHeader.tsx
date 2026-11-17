import { Brand, Button } from './DesignUI';
import './AppHeader.css';

type HeaderLink = { href: string; label: string };

/** Shared signed-in navigation; initials are decorative alongside the full name. */
export default function AppHeader({ name, links, onSignOut }: {
  name: string;
  links: readonly HeaderLink[];
  onSignOut: () => void;
}) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase();

  return <header className="workspace-header app-header">
    <Brand light />
    <nav aria-label="Workspace">
      {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
    </nav>
    <div className="app-header-account">
      <span className="app-header-initials" aria-hidden="true">{initials}</span>
      <span className="app-header-name">Signed in as {name}</span>
      <Button variant="secondary" size="sm" onClick={onSignOut}>Sign out</Button>
    </div>
  </header>;
}
