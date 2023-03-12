export function HoverBox({ isHovered, coords, content }: HoverBoxProps) {
  return (
    <span
      className={`hoverBox xxsmall ${isHovered ? 'show' : 'hidden'}`}
      style={{
        position: 'fixed',
        left: coords.x,
        top: coords.y,
      }}
    >
      {content}
    </span>
  );
}

// SECITON : Interfaces

interface HoverBoxProps {
  isHovered: boolean;
  coords: { x: number; y: number };
  content: string;
}

export interface Coordinates {
  x: number;
  y: number;
}
