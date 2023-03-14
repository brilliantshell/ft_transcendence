function MatchHistory(props: {
  history:
    | {
        matchId: number;
        winner: { userId: number; nickname: string; isDefaultImage: boolean };
        loser: { userId: number; nickname: string; isDefaultImage: boolean };
        score: Array<number>;
        isRank: boolean;
      }
    | undefined;
}) {
  return (
    <div className="matchHistory">
      <div className="matchHistoryItem">
        WINNER {props.history?.winner.nickname}
      </div>
      <div className="matchHistoryItem">
        LOSER {props.history?.loser.nickname}
      </div>
      <div className="matchHistoryItem">
        <p>SCORE</p>
        <p>
          {props.history?.score[0]} : {props.history?.score[1]}
        </p>
      </div>
      <div className="matchHistoryItem">
        TYPE: {props.history?.isRank ? 'LADDER' : 'RANDOM'}
      </div>
    </div>
  );
}

function MatchHistoryList(props: {
  history:
    | Array<{
        matchId: number;
        winner: { userId: number; nickname: string; isDefaultImage: boolean };
        loser: { userId: number; nickname: string; isDefaultImage: boolean };
        score: Array<number>;
        isRank: boolean;
      }>
    | undefined;
}) {
  return (
    <div className="profileItem matchHistoryList">
      {props.history?.map(matchLog => (
        <MatchHistory history={matchLog} key={matchLog.matchId} />
      ))}
    </div>
  );
}

export default MatchHistoryList;
