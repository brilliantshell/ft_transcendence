function MatchHistory(props: {
  history:
    | {
        winner: string;
        loser: string;
        score: Array<number>;
        isRank: boolean;
      }
    | undefined;
}) {
  return (
    <div className="matchHistory">
      <div className="matchHistoryItem">WINNER {props.history?.winner}</div>
      <div className="matchHistoryItem">LOSER {props.history?.loser}</div>
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
        winner: string;
        loser: string;
        score: Array<number>;
        isRank: boolean;
      }>
    | undefined;
}) {
  return (
    /* TODO - MatchHistory의 ID까지 받아 동작하도록 수정 */
    <div className="profileItem matchHistoryList">
      {props.history?.map((matchLog, index) => (
        <MatchHistory history={matchLog} key={index} />
      ))}
    </div>
  );
}

export default MatchHistoryList;
