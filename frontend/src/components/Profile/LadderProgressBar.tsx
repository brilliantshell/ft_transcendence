/* TODO - level의 최고값이 100일 것으로 예상했으나, 수정 필요할 듯 */
function LadderProgressBar(props: { ladder: number | undefined }) {
  return (
    <div className="profileItem ladderBar">
      <div>LEVEL {props.ladder}</div>
      <div
        className="ladderProportion"
        style={{ width: `${props.ladder}%` }}
      ></div>
    </div>
  );
}

export default LadderProgressBar;
