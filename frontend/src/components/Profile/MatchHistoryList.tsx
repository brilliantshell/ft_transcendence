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
        <div>SCORE</div>
        <div>
          {props.history?.score[0]} : {props.history?.score[1]}
        </div>
      </div>
      <div className="matchHistoryItem">
        TYPE: {props.history?.isRank ? 'LADDER' : 'RANDOM'}
      </div>
      <img
        className="matchHistoryItem matchProfileImg"
        src={
          props.history?.winner.isDefaultImage
            ? '/assets/defaultProfile.svg'
            : `/assets/profile-image/${props.history?.winner.userId}`
        }
      ></img>
      <img
        className="matchHistoryItem matchProfileImg"
        src={
          props.history?.loser.isDefaultImage
            ? '/assets/defaultProfile.svg'
            : `/assets/profile-image/${props.history?.loser.userId}`
        }
      ></img>
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
