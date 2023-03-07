import { useState, useEffect } from 'react';

export function useCanvasResize(parentRef: React.RefObject<HTMLDivElement>) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const handleResize = () => {
      if (parentRef.current) {
        setWidth((parentRef.current.offsetWidth * 19) / 20);
        setHeight((parentRef.current.offsetHeight * 19) / 20);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { w: width, h: height };
}
