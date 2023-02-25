import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserInfo } from './SearchModal';
import { Link } from 'react-router-dom';

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
        <div className="searchResults" ref={resultRef}>
          {searchResult.map((user, index) => {
            return (
              <div
                key={index}
                className={`searchResultsItem ${
                  index === cursor ? 'searchResultActive' : ''
                }`}
              >
                <Link
                  to={`/profile/${user.userId}`}
                  className="searchItemLink"
                  onClick={() => setShowSearch(false)}
                >
                  <img
                    src="http://localhost:5173/assets/defaultProfile"
                    className="searchItemImage"
                  />
                  {/* FIXME: <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
                  <span className="searchItemNickname">{user.nickname}</span>
                </Link>
              </div>
            );
          })}
        </div>
      }
    </>
  );
};

export default SearchResult;
