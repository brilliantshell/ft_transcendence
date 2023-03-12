import GameOptionSelectionButton from './GameOptionSelectionButton';
import instance from '../../util/Axios';
import { isOptionSubmittedState } from '../../util/Recoils';
import { useSetRecoilState } from 'recoil';
import { useState } from 'react';

export default function GameOptionForm({ gameId }: GameOptionFormProps) {
  const [option, setOption] = useState(0);
  const setIsOptionSubmitted = useSetRecoilState(isOptionSubmittedState);

  const handleSubmit = () => {
    instance.patch(`/game/${gameId}/options`, { mode: option }).then(() => {
      setIsOptionSubmitted(true);
    });
  };

  const optionNames = ['NORMAL', 'LARGER BALL', 'SHORTER PADDLES'];

  return (
    <form className="gameOptionForm">
      <div className="gameOptionSelections">
        {optionNames.map((name, i) => (
          <GameOptionSelectionButton
            optionId={i}
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
}
