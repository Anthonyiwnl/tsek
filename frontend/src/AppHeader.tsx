import { useId, useRef, useState } from 'react';
import { Brand, Button, Icon } from './DesignUI';
import './AppHeader.css';

type HeaderLink = { href: string; label: string };

/** Shared signed-in navigation; initials are decorative alongside the full name. */
export default function AppHeader({ name, links, onSignOut }: {
  name: string;
  links: readonly HeaderLink[];
  onSignOut: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const menuId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase();

  return <header className="workspace-header app-header" data-expanded={expanded} onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { setExpanded(false); toggle.current?.focus(); }
  }}>
    <Brand light />
    <span className="app-header-initials" aria-hidden="true">{initials}</span>
    <nav id={menuId} aria-label="Workspace">
      {links.map(link => <a key={link.href} href={link.href} onClick={() => { setExpanded(false); }}>{link.label}</a>)}
    </nav>
    <div className="app-header-account" id={`${menuId}-account`}>
      <span className="app-header-name">Signed in as {name}</span>
      <Button variant="secondary" size="sm" onClick={onSignOut}>Sign out</Button>
    </div>
    <button ref={toggle} type="button" className="app-header-toggle" aria-label="Workspace menu" aria-expanded={expanded} aria-controls={`${menuId} ${menuId}-account`} onClick={() => setExpanded(value => !value)}><Icon name="menu" /></button>
  </header>;
}
