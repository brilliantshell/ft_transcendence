import { useEffect, useRef, useState } from 'react';
import { UserInfo } from './SearchModal';
import { useKeyPress } from './hooks/SearchKeyPress';

interface SearchModalBodyProps {
  searchResult: Array<UserInfo>;
  searchAction: (targetId: number) => void;
}

function SearchModalBody({
  searchResult,
  searchAction,
}: SearchModalBodyProps) {
  const downPressed = useKeyPress('ArrowDown');
  const upPressed = useKeyPress('ArrowUp');
  const enterPressed = useKeyPress('Enter');
  const [cursor, setCursor] = useState<number>(0);
  const bodyRef = useRef<HTMLDivElement>(null);

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
    bodyRef.current?.children[cursor].scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  useEffect(() => {
    if (enterPressed && searchResult.length > 0) {
      searchAction(searchResult[cursor].userId);
    }
  }, [enterPressed]);

  return (
    <div className="searchModalBody" ref={bodyRef}>
      {searchResult.map((user, index) => {
        return (
          <div
            key={`search-${index}`}
            className={`searchResult ${
              index === cursor ? 'searchResultActive' : ''
            }`}
            onMouseOver={() => setCursor(index)}
            onClick={() => searchAction(user.userId)}
          >
            <img
              src="http://localhost:5173/assets/defaultProfile.svg"
              className="searchResultImage selectNone"
            />
            {/* FIXME: <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
            <span className="textBold">{user.nickname}</span>
          </div>
        );
      })}
    </div>
  );
}

export default SearchModalBody;
