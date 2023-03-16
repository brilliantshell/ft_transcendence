import GameOptionSelectionButton from './GameOptionSelectionButton';
import instance from '../../util/Axios';
import { useState } from 'react';

export default function GameOptionForm({
  gameId,
  setIsOptionSubmitted,
}: GameOptionFormProps) {
  const [option, setOption] = useState<0 | 1 | 2>(0);

  const handleSubmit = () => {
    instance
      .patch(`/game/${gameId}/options`, { mode: option })
      .then(() => setIsOptionSubmitted(true));
  };

  const optionNames = ['NORMAL', 'LARGER BALL', 'SHORTER PADDLES'];

  return (
    <form className="gameOptionForm">
      <div className="gameOptionSelections">
        {optionNames.map((name, i) => (
          <GameOptionSelectionButton
            key={i}
            optionId={i as 0 | 1 | 2}
            text={name}
            currentOption={option}
            setOption={setOption}
          />
        ))}
      </div>
      <button
        className="gameOptionSubmitButton regular"
        type="button"
        onClick={handleSubmit}
      >
        SUBMIT
      </button>
    </form>
  );
}

// SECTION : Interfaces

interface GameOptionFormProps {
  gameId: string;
  setIsOptionSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
}
