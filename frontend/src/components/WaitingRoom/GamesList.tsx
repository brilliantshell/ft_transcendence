import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import GameInProgressButton from './GameInProgressButton';

export default function GamesList() {
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
            <GameInProgressButton
              leftNickname={game.left}
              rightNickname={game.right}
            />
          </div>
        );
      })}
    </div>
  );
}
