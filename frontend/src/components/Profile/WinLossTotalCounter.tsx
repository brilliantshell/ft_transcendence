import '../../style/Profile/WinLossTotalCounter.css';

function WinLossTotalCounter(props: { winLoss: Array<number> | undefined }) {
  return (
    <div className="profileItem">
      <div>Win: {props.winLoss?.at(0)}</div>
      <div>Loss: {props.winLoss?.at(1)}</div>
    </div>
  );
}

export default WinLossTotalCounter;
