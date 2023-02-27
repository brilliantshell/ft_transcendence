import { useEffect, useState } from 'react';
import instance from '../../util/Axios';

export default function GamesInProgress() {
  const [games, setGames] = useState<
    { id: string; left: string; right: string }[]
  >([
    {
      id: 'example',
      left: 'ghan',
      right: 'yongjule',
    },
    {
      id: 'example',
      left: 'eunlee',
      right: 'hankkim',
    },
    {
      id: 'example',
      left: 'jiskim',
      right: 'hannkim',
    },
    {
      id: 'example',
      left: 'nkim',
      right: 'jiychoi',
    },
    {
      id: 'example',
      left: 'ghan',
      right: 'yongjule',
    },
    {
      id: 'example',
      left: 'eunlee',
      right: 'hankkim',
    },
    {
      id: 'example',
      left: 'jiskim',
      right: 'hannkim',
    },
    {
      id: 'example',
      left: 'nkim',
      right: 'jiychoi',
    },
  ]);
  useEffect(() => {
    // instance
    //   .get('/game/list')
    //   .then(({ data }) => {
    //     setGames(data.games);
    //   })
    //   .catch(err => {
    //     /* do somethin */
    //   });
  }, []);

  return (
    <div className="gamesList">
      {games?.map(game => {
        return (
          <div className="gameWrapper">
            <button className="gameInProgressButton xxlarge">
              <div>{game.left}</div>
              <div className="xlarge">VS</div>
              <div>{game.right}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
