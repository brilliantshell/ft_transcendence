const IMG_PATH = '/assets/achievements/achievement';

function AchievementElement(props: {
  achievement: {
    id: number;
    title: string;
    about: string;
  };
}) {
  return (
    <div className="achievementElement">
      <img
        className="achievementImage"
        src={IMG_PATH + props.achievement.id + '.png'}
      ></img>
      <span className="achievementTooltip">
        <div>{props.achievement.title}</div>
        <div>{props.achievement.about}</div>
      </span>
    </div>
  );
}

function Achievements(props: {
  achievements: Array<{ id: number; title: string; about: string }> | undefined;
}) {
  return (
    <div className="profileItem achievementBar">
      <div className="achievementBar">
        {props.achievements?.map(achievementItem => (
          <AchievementElement
            achievement={achievementItem}
            key={achievementItem.id}
          />
        ))}
      </div>
    </div>
  );
}

export default Achievements;
