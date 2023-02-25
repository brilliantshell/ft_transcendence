import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserInfo } from './SearchModal';
import '../../style/Search.css';

interface SearchResultProps {
  searchResult: Array<UserInfo>;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
}

const useKeyPress = function (targetKey: string) {
  const [keyPressed, setKeyPressed] = useState<boolean>(false);

  function downHandler({ key }: { key: string }) {
    if (key === targetKey) {
      setKeyPressed(true);
    }
  }

  const upHandler = ({ key }: { key: string }) => {
    if (key === targetKey) {
      setKeyPressed(false);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', downHandler);
    document.addEventListener('keyup', upHandler);

    return () => {
      document.removeEventListener('keydown', downHandler);
      document.removeEventListener('keyup', upHandler);
    };
  });

  return keyPressed;
};

const SearchResult = ({ searchResult, setShowSearch }: SearchResultProps) => {
  const resultRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const downPressed = useKeyPress('ArrowDown');
  const upPressed = useKeyPress('ArrowUp');
  const enterPressed = useKeyPress('Enter');
  const [cursor, setCursor] = useState<number>(0);

  useEffect(() => {
    if (downPressed && cursor < searchResult.length - 1) {
      setCursor(cursor + 1);
    }
  }, [downPressed]);

  useEffect(() => {
    if (upPressed && cursor > 0) {
      setCursor(cursor - 1);
    }
  }, [upPressed]);

  useEffect(() => {
    if (searchResult.length > 0) {
      resultRef.current?.children[cursor].scrollIntoView({
        block: 'nearest',
      });
      resultRef.current?.children[cursor];
    }
  }, [cursor]);

  useEffect(() => {
    if (enterPressed && searchResult.length > 0) {
      nav(`/profile/${searchResult[cursor].userId}`);
      setShowSearch(false);
    }
  }, [enterPressed]);

  return (
    <>
      {
        <div className="search-results" ref={resultRef}>
          {searchResult.map((user, index) => {
            return (
              <div
                key={index}
                className={`search-results-item ${
                  index === cursor ? 'active' : ''
                }`}
              >
                <a
                  href={`/profile/${user.userId}`}
                  className="search-item-anchor"
                >
                  <img
                    src="http://localhost:5173/assets/defaultProfile"
                    className="search-item-img"
                  />
                  {/* FIXME: <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
                  <span className="search-item-nickname">{user.nickname}</span>
                </a>{' '}
              </div>
            );
          })}
        </div>
      }
    </>
  );
};

export default SearchResult;
