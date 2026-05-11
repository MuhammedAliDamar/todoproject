import type { CSSProperties, ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
  sw?: number;
  fill?: string;
  stroke?: string;
  style?: CSSProperties;
  children?: ReactNode;
  d?: string;
};

function Icon({
  d,
  size = 16,
  fill = "none",
  stroke = "currentColor",
  sw = 1.6,
  children,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const IconBoard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="18" rx="1.5" />
    <rect x="14" y="3" width="7" height="11" rx="1.5" />
  </Icon>
);
export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </Icon>
);
export const IconTimeline = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="10" height="3" rx="1" />
    <rect x="7" y="10" width="13" height="3" rx="1" />
    <rect x="5" y="15" width="9" height="3" rx="1" />
  </Icon>
);
export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);
export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12.5l5 5 11-12" />
  </Icon>
);
export const IconBolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </Icon>
);
export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2l9 5-9 5-9-5 9-5z" />
    <path d="M3 12l9 5 9-5M3 17l9 5 9-5" />
  </Icon>
);
export const IconBrain = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3a3 3 0 0 0-3 3v0a2.5 2.5 0 0 0-2.5 2.5v0A2.5 2.5 0 0 0 5 11v0a2 2 0 0 0-1 1.7v0A2.3 2.3 0 0 0 5 15v0a2 2 0 0 0 1 1.7v0A2 2 0 0 0 8 19v0a2 2 0 0 0 2 2h2V3H9z" />
    <path d="M15 3a3 3 0 0 1 3 3v0a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 19 11v0a2 2 0 0 1 1 1.7v0A2.3 2.3 0 0 1 19 15v0a2 2 0 0 1-1 1.7v0A2 2 0 0 1 16 19v0a2 2 0 0 1-2 2h-2" />
  </Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);
export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 5l12 7-12 7V5z" fill="currentColor" />
  </Icon>
);
export const IconStar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l3 6 6.5 1-4.7 4.6 1.1 6.5L12 18l-5.9 3.1L7.2 14.6 2.5 10l6.5-1 3-6z" />
  </Icon>
);
export const IconFilter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />
  </Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconMsg = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.5A8 8 0 0 1 21 12z" />
  </Icon>
);
export const IconPaperclip = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12.5L13 20.5a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L11 18.5a2 2 0 0 1-3-3L15.5 8" />
  </Icon>
);
export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Icon>
);
