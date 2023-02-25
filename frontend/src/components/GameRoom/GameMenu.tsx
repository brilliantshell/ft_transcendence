export default function GameMenu({ isOwner }: GameMenuProps) {
  return (
    <div className="gameMenu">
      <button className="gameButton gameStartButton" type="button">
        START GAME
      </button>
      {isOwner && (
        <button className="gameButton gameMapButton" type="button">
          MAPS
        </button>
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GameMenuProps {
  isOwner: boolean;
}
