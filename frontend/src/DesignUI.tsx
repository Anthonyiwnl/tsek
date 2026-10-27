import { type ReactNode } from "react";

export type IconName =
  | "home"
  | "plus"
  | "file"
  | "folder"
  | "bell"
  | "settings"
  | "help"
  | "logout"
  | "search"
  | "chevron"
  | "check"
  | "clock"
  | "warning"
  | "upload"
  | "shield"
  | "spark"
  | "menu"
  | "eye"
  | "trash"
  | "arrow";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.8 12 3l9 7.8" />
      <path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  file: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 13h6M9 17h5" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6h7l2 2h9v11H3z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6a8 8 0 0 0-1.7 1.1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.5-1.2.9-1.2 1.9M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v5h16v-5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5.5 3.4 9 8 11 4.6-2 8-5.5 8-11V5z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </>
  ),
};

/** Render a decorative icon from the shared SVG paths at the requested size. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/** Render a styled button with the supplied content, state, and click callback. */
export function Button({
  children,
  variant = "primary",
  onClick,
  disabled = false,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** The approved Figma vector, kept at its intrinsic exported dimensions. */
export function LogoImage({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo-vector-slot ${light ? "is-light" : ""}`}>
      <img
        className="logo-vector"
        src={
          light
            ? "/figma/logo-reversed.svg"
            : "/figma/1-imgForwardMarkEditableRibbonVectors.svg"
        }
        alt=""
        aria-hidden="true"
      />
    </span>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`brand refined-brand ${light ? "brand-light" : ""}`}
      aria-label="TSEK"
    >
      <LogoImage light={light} />
      <span className="brand-wordmark">TSEK</span>
    </div>
  );
}

const figmaIcons = {
  home: "1-imgIcon",
  file: "1-imgIcon1",
  folder: "1-imgIcon2",
  bell: "1-imgIcon3",
  shield: "1-imgIcon4",
  search: "1-imgIcon5",
  sparkLight: "1-imgIcon6",
  shieldSmall: "1-imgIcon7",
  homeMuted: "2-imgIcon",
  fileActive: "2-imgIcon1",
  fileReady: "2-imgIcon6",
  check: "2-imgIcon7",
  upload: "2-imgIcon8",
  sparkWarning: "2-imgIcon9",
  spark: "2-imgIcon10",
};
/** Exact static vector assets from the approved Figma screens. */
export function FigmaIcon({ name }: { name: keyof typeof figmaIcons }) {
  return (
    <img
      className="figma-icon"
      src={`/figma/${figmaIcons[name]}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}

/** Render a status label and dot using the requested tone. */
export function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "error" | "info" | "neutral";
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
