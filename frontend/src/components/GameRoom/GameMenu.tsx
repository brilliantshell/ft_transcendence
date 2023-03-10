export default function GameMenu({ gameId, isRank, isOwner }: GameMenuProps) {
  const handleMapClick = () => {};

  return (
    <div className="gameMenu">
      {!isRank && (
        <button
          className="gameButton gameStartButton"
          type="button"
          onClick={() =>
            sessionStorage.setItem(`game-${gameId}-isStarted`, 'true')
          }
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
  gameId: string;
  isRank: boolean;
  isOwner: boolean;
}
