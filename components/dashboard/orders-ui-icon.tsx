interface OrdersUiIconProps {
  icon:
    | "box"
    | "chevron-down"
    | "chevron-up"
    | "clipboard"
    | "clipboard-check"
    | "eye"
    | "edit"
    | "filter"
    | "map-pin"
    | "minus"
    | "package"
    | "plus"
    | "save"
    | "search"
    | "wallet"
    | "x";
  className?: string;
}

function IconFrame({
  children,
  className = "h-4 w-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function OrdersUiIcon({
  icon,
  className = "h-4 w-4 shrink-0",
}: OrdersUiIconProps) {
  switch (icon) {
    case "search":
      return (
        <IconFrame className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </IconFrame>
      );
    case "plus":
      return (
        <IconFrame className={className}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </IconFrame>
      );
    case "minus":
      return (
        <IconFrame className={className}>
          <path d="M5 12h14" />
        </IconFrame>
      );
    case "package":
      return (
        <IconFrame className={className}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M12 12 4 7.5" />
          <path d="M12 12l8-4.5" />
          <path d="M12 21v-9" />
        </IconFrame>
      );
    case "box":
      return (
        <IconFrame className={className}>
          <path d="m12 3.8 7 3.7v8.4l-7 3.7-7-3.7V7.5l7-3.7Z" />
          <path d="M5 7.5 12 11l7-3.5" />
          <path d="M12 11v8.5" />
        </IconFrame>
      );
    case "clipboard":
      return (
        <IconFrame className={className}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 4.5h6" />
          <path d="M9 10h6" />
          <path d="M9 14h4" />
        </IconFrame>
      );
    case "clipboard-check":
      return (
        <IconFrame className={className}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 4.5h6" />
          <path d="m9.5 13 1.8 1.8 3.7-3.8" />
        </IconFrame>
      );
    case "eye":
      return (
        <IconFrame className={className}>
          <path d="M2.8 12S6.1 6.5 12 6.5 21.2 12 21.2 12 17.9 17.5 12 17.5 2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.2" />
        </IconFrame>
      );
    case "map-pin":
      return (
        <IconFrame className={className}>
          <path d="M12 20s5-4.8 5-9a5 5 0 1 0-10 0c0 4.2 5 9 5 9Z" />
          <circle cx="12" cy="11" r="1.7" />
        </IconFrame>
      );
    case "wallet":
      return (
        <IconFrame className={className}>
          <path d="M4.5 7.5h13a2 2 0 0 1 2 2v7h-13a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
          <path d="M4.5 9V7a2 2 0 0 1 2-2h9" />
          <circle cx="16.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </IconFrame>
      );
    case "edit":
      return (
        <IconFrame className={className}>
          <path d="m4 20 4.2-1 9.1-9.1a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
          <path d="m13.5 7.5 3 3" />
        </IconFrame>
      );
    case "save":
      return (
        <IconFrame className={className}>
          <path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V4.5Z" />
          <path d="M8 4.5v5h7v-5" />
          <path d="M9 16h6" />
        </IconFrame>
      );
    case "filter":
      return (
        <IconFrame className={className}>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </IconFrame>
      );
    case "x":
      return (
        <IconFrame className={className}>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </IconFrame>
      );
    case "chevron-up":
      return (
        <IconFrame className={className}>
          <path d="m6 14 6-6 6 6" />
        </IconFrame>
      );
    case "chevron-down":
    default:
      return (
        <IconFrame className={className}>
          <path d="m6 10 6 6 6-6" />
        </IconFrame>
      );
  }
}
