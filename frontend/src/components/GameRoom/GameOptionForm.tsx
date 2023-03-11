import GameOptionSelectionButton from './GameOptionSelectionButton';
import { useState } from 'react';

export default function GameOptionForm({ gameId }: GameOptionFormProps) {
  const [option, setOption] = useState(0);
  return (
    <form className="gameOptionForm">
      <div className="gameOptionSelections">
        <GameOptionSelectionButton optionId={0} text="NORMAL" />
        <GameOptionSelectionButton optionId={1} text="LARGER BALL" />
        <GameOptionSelectionButton optionId={2} text="SHORTER PADDLES" />
      </div>
      <button className="gameOptionSubmitButton regular" type="button">
        SUBMIT
      </button>
    </form>
  );
}

// SECTION : Interfaces

interface GameOptionFormProps {
  gameId: string;
}
