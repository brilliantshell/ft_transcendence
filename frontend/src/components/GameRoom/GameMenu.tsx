export default function GameMenu({
  isRank,
  isOwner,
  startGame,
}: GameMenuProps) {
  const handleStartClick = () => startGame();

  const handleMapClick = () => {};

  return (
    <div className="gameMenu">
      {!isRank && (
        <button
          className="gameButton gameStartButton"
          type="button"
          onClick={handleStartClick}
        >
          START GAME
        </button>
      )}
      {!isRank && isOwner && (
        <button className="gameButton gameMapButton" type="button">
          MAPS
        </button>
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GameMenuProps {
  isRank: boolean;
  isOwner: boolean;
  startGame: () => void;
}
