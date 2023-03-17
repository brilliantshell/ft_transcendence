function WinLossTotalCounter(props: { winLoss: Array<number> | undefined }) {
  return (
    <div className="profileItem">
      <span className="winLossCounter">WIN {props.winLoss?.at(0)}</span>
      <span className="winLossCounter">LOSE {props.winLoss?.at(1)}</span>
    </div>
  );
}

export default WinLossTotalCounter;
