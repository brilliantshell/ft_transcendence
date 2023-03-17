import { CSSProperties } from 'react';

export function generateWavyText(text: string, waveAmount: string) {
  return (
    <>
      {text.split('').map((char, i) => (
        <span
          className="wavySpans"
          key={i}
          style={
            {
              '--i': i.toString(),
              '--wave_amount': waveAmount,
            } as CSSProperties
          }
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </>
  );
}
