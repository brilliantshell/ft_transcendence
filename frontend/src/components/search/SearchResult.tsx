import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserInfo } from './SearchModal';
import { Link } from 'react-router-dom';

interface SearchResultProps {
  searchResult: Array<UserInfo>;
  searchBodyRef: React.RefObject<HTMLDivElement>;
  hideModal : () => void;
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

const SearchResult = ({
  searchResult,
  hideModal,
  searchBodyRef: bodyRef,
}: SearchResultProps) => {
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
      bodyRef.current?.children[cursor].scrollIntoView({
        block: 'nearest',
      });
      bodyRef.current?.children[cursor];
    }
  }, [cursor]);

  useEffect(() => {
    if (enterPressed && searchResult.length > 0) {
      nav(`/profile/${searchResult[cursor].userId}`);
      hideModal();
    }
  }, [enterPressed]);

  return (
    <>
<<<<<<< HEAD
      {searchResult.map((user, index) => {
        return (
          <Link
            key={index}
            className={`searchResult ${
              index === cursor ? 'searchResultActive' : ''
            }`}
            onMouseOver={() => setCursor(index)}
            to={`/profile/${user.userId}`}
            onClick={() => hideModal() }
          >
            <img
              src="http://localhost:5173/assets/defaultProfile.svg"
              className="searchResultImage"
            />
            {/* FIXME: <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
            <span className="searchResultNickname">{user.nickname}</span>
          </Link>
        );
      })}
=======
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
>>>>>>> 9d2b527824ea3113b9d23333a99a5ee1dde04157
    </>
  );
};

export default SearchResult;
