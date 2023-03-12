import {
  GameOptionLargerBallSvg,
  GameOptionNormalBallSvg,
  GameOptionPaddleSvg,
} from './GameOptionSvg';
import { useRef } from 'react';

export default function GameOptionSelectionButton({
  optionId,
  text,
  currentOption,
  setOption,
}: GameOptionSelectionButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const optionSvgs = [
    <>
      <GameOptionPaddleSvg option="Normal" />
      <GameOptionNormalBallSvg
        buttonHeight={ref.current?.clientHeight}
        buttonWidth={ref.current?.clientWidth}
      />
    </>,
    <GameOptionLargerBallSvg />,
    <GameOptionPaddleSvg option="ShorterPaddle" />,
  ];

  return (
    <button
      className={
        'gameOptionSelectionButton regular' +
        (optionId === currentOption ? ' gameOptionSelected' : '')
      }
      type="button"
      ref={ref}
      onClick={() => setOption(optionId)}
    >
      {optionSvgs[optionId]}
      <p className="gameOptionSelectionName">{text}</p>
    </button>
  );
}

// SECTION : Interfaces

interface GameOptionSelectionButtonProps {
  optionId: number;
  text: string;
  currentOption: number;
  setOption: React.Dispatch<React.SetStateAction<number>>;
}
