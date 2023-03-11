const IMG_PATH = '/assets/achievements/achievement';

/* TODO
 * - 아이콘 하나씩 컴포넌트화 하기 - 진행중
 * - 받아온 array에서 값 불러오기...
 */

function AchievementElement(props: {
  achievementId: number;
  achievementTitle: string;
  achievementAbout: string;
}) {
  return (
    <li className="achievementElement">
      <img
        className="achievementImage"
        src={IMG_PATH + props.achievementId + '.png'}
      ></img>
      <span className="achievementTooltip">
        <div>{props.achievementTitle}</div>
        <div>{props.achievementAbout}</div>
      </span>
    </li>
  );
}

function Achievements(props: {
  achievements: Array<{ id: number; title: string; about: string }> | undefined;
}) {
  // return (
  //   (props.achievements &&
  // <div className='profileItem'>
  //   <ul className='achievementBar'>
  //     {props.achievements?.map(item, index) => (
  //       <AchievementElement achievement={item}/>
  //     )}
  //   </ul>
  // </div>) || <div className='profileItem'>Error</div>
  // );
  return (
    <div className="profileItem">
      <ul className="achievementBar">
        <li className="achievementElement">
          <img className="achievementImage" src={IMG_PATH + '1.png'}></img>
          <span className="achievementTooltip">
            <div>ONE GIANT LEAP FOR MANKIND</div>
            <div>
              누군가에겐 미약해 보일 수 있지만, 분명히 그것은 위대한 첫 걸음
              입니다. 당신은 처음으로 승리하였습니다. 추카포카~🎉
            </div>
          </span>
        </li>
        <li className="achievementElement">
          <img className="achievementImage" src={IMG_PATH + '2.png'}></img>
          <span className="achievementTooltip">
            <div>THE WORLD'S BEST PINGPONG PLAYER</div>
            <div>
              초월적인 온라인 탁구 게임에서 1등을 거머쥐었습니다! 대박사건~
            </div>
          </span>
        </li>
        <li className="achievementElement">
          <img className="achievementImage" src={IMG_PATH + '3.png'}></img>
          <span className="achievementTooltip">
            <div>SOCIAL ANIMAL</div>
            <div>무려 10명의 친구! 아리스토텔레스가 당신을 부러워합니다.</div>
          </span>
        </li>
        <li className="achievementElement">
          <img className="achievementImage" src={IMG_PATH + '4.png'}></img>
          <span className="achievementTooltip">
            <div>BORN TO BE FT</div>
            <div>
              삶, 우주, 그리고 모든 것에 대한 궁극적인 질문에 대한 해답은 바로
              당신!
            </div>
          </span>
        </li>
        <li className="achievementElement">
          <img className="achievementImage" src={IMG_PATH + '5.png'}></img>
          <span className="achievementTooltip">
            <div>SO NOISY</div>
            <div>U R MY CELEBRITY</div>
          </span>
        </li>
      </ul>
    </div>
  );
}

export default Achievements;
