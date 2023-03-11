import {
  GameOptionLargerBallSvg,
  GameOptionNormalBallSvg,
  GameOptionPaddleSvg,
} from './GameOptionSvg';
import { useRef } from 'react';

export default function GameOptionSelectionButton({
  optionId,
  text,
}: GameOptionSelectionButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      className="gameOptionSelectionButton regular"
      type="button"
      ref={ref}
    >
      {
        [
          <>
            <GameOptionPaddleSvg option="Normal" />
            <GameOptionNormalBallSvg
              buttonHeight={ref.current?.clientHeight}
              buttonWidth={ref.current?.clientWidth}
            />
          </>,
          <GameOptionLargerBallSvg />,
          <GameOptionPaddleSvg option="ShorterPaddle" />,
        ][optionId]
      }
      <p className="gameOptionSelectionName">{text}</p>
    </button>
  );
}

// SECTION : Interfaces

interface GameOptionSelectionButtonProps {
  optionId: number;
  text: string;
}
