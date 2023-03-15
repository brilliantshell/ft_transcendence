const MAX_LEVEL = 1000;

function LadderProgressBar(props: { ladder: number }) {
  return (
    <div className="profileItem ladderBar">
      <span className="ladderBarItem">LEVEL {props.ladder}</span>
      <div
        className="ladderBarItem ladderProportion"
        style={{ width: `${(props.ladder / MAX_LEVEL) * 100}%` }}
      ></div>
    </div>
  );
}

export default LadderProgressBar;
