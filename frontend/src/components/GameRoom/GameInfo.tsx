export default function GameInfo({
  isRank,
  leftPlayer,
  rightPlayer,
}: GameInfoProps) {
  return (
    <div className="gameInfo">
      <div className="playerInfo xxlarge textBold">{leftPlayer}</div>
      <div className="gameType">
        <p className="textItalic">{isRank ? 'LADDER' : 'NORMAL'}</p>
        <p className="xlarge textBold">VS</p>
      </div>
      <div className="playerInfo xxlarge textBold">{rightPlayer}</div>
    </div>
  );
}

// SECTION : Interfaces

interface GameInfoProps {
  isRank: boolean;
  leftPlayer: string;
  rightPlayer: string;
}
