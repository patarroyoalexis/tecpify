import type { StatusIconKey } from "@/lib/orders/transitions";

interface StatusBadgeIconProps {
  iconKey: StatusIconKey;
  className?: string;
}

function IconFrame({
  children,
  className = "h-3.5 w-3.5",
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

export function StatusBadgeIcon({
  iconKey,
  className = "h-3.5 w-3.5 shrink-0",
}: StatusBadgeIconProps) {
  switch (iconKey) {
    case "clock":
      return (
        <IconFrame className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </IconFrame>
      );
    case "circle-check":
      return (
        <IconFrame className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.3 2.3 4.7-4.8" />
        </IconFrame>
      );
    case "alert-circle":
      return (
        <IconFrame className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.5v4.5" />
          <path d="M12 16.5h.01" />
        </IconFrame>
      );
    case "circle-x":
      return (
        <IconFrame className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="m9.5 9.5 5 5" />
          <path d="m14.5 9.5-5 5" />
        </IconFrame>
      );
    case "rotate-ccw":
      return (
        <IconFrame className={className}>
          <path d="M3.5 10.5V6.5h4" />
          <path d="M4 12a8 8 0 1 0 2.3-5.7L3.5 8.8" />
        </IconFrame>
      );
    case "inbox":
      return (
        <IconFrame className={className}>
          <path d="M5 6.5h14l1.5 8.5h-5.2l-1.7 2h-3.2l-1.7-2H3.5L5 6.5Z" />
          <path d="M5 6.5 4 18" />
          <path d="M19 6.5 20 18" />
        </IconFrame>
      );
    case "clipboard-check":
      return (
        <IconFrame className={className}>
          <rect x="6.5" y="5" width="11" height="14" rx="2" />
          <path d="M9.5 5.5h5a1 1 0 0 0 1-1v0a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1Z" />
          <path d="m9.5 12 1.8 1.8 3.7-3.8" />
        </IconFrame>
      );
    case "package-open":
      return (
        <IconFrame className={className}>
          <path d="m12 3.8 7 3.7-7 3.7-7-3.7 7-3.7Z" />
          <path d="M5 7.5V16l7 4 7-4V7.5" />
          <path d="M12 11.2V20" />
        </IconFrame>
      );
    case "truck":
      return (
        <IconFrame className={className}>
          <path d="M4.5 7.5h9v7h-9Z" />
          <path d="M13.5 10h3l2 2v2.5h-5Z" />
          <circle cx="8" cy="17" r="1.5" />
          <circle cx="17" cy="17" r="1.5" />
        </IconFrame>
      );
    case "package-check":
      return (
        <IconFrame className={className}>
          <path d="m12 3.8 7 3.7v8.4l-7 3.7-7-3.7V7.5l7-3.7Z" />
          <path d="M5 7.5 12 11l7-3.5" />
          <path d="m9.5 14 1.7 1.7 3.3-3.4" />
        </IconFrame>
      );
    case "dot":
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}
