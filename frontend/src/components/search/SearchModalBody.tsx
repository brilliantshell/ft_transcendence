import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { UserInfo } from './SearchModal';
import { useKeyPress } from './hooks/SearchKeyPress';

interface SearchModalBodyProps {
  searchResult: Array<UserInfo>;
  hideModal: () => void;
}

function SearchModalBody({ searchResult, hideModal }: SearchModalBodyProps) {
  const nav = useNavigate();
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
      nav(`/profile/${searchResult[cursor].userId}`);
      hideModal();
    }
  }, [enterPressed]);

  return (
    <div className="searchModalBody" ref={bodyRef}>
      {searchResult.map((user, index) => {
        return (
          <Link
            key={index}
            className={`searchResult ${
              index === cursor ? 'searchResultActive' : ''
            }`}
            onMouseOver={() => setCursor(index)}
            to={`/profile/${user.userId}`}
            onClick={() => hideModal()}
          >
            <img
              src="http://localhost:5173/assets/defaultProfile.svg"
              className="searchResultImage selectNone"
            />
            {/* FIXME: <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
            <span className="textBold">{user.nickname}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default SearchModalBody;
