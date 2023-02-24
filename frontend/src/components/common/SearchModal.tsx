import { useEffect, useRef, useState } from 'react';
import instance from '../../util/Axios';
import '../../style/Search.css';
import { useNavigate } from 'react-router-dom';

interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

interface SearchModalProps {
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

function SearchModal({ setShowSearch }: SearchModalProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);
  const [cursor, setCursor] = useState<number>(0);
  const downPressed = useKeyPress('ArrowDown');
  const upPressed = useKeyPress('ArrowUp');
  const enterPressed = useKeyPress('Enter');
  const nav = useNavigate();

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
    if (enterPressed) {
      nav(`/profile/${searchResult[cursor].userId}`);
      setShowSearch(false)
    }
  }, [enterPressed]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    if (e.target.value === '') {
      setSearchResult([]);
      return;
    }
    instance.get(`/search?value=${e.target.value}`).then(res => {
      setSearchResult(res.data);
    });
  }

  function handleClickOutside(e: MouseEvent) {
    if (searchRef.current && searchRef.current === (e.target as Node)) {
      setShowSearch(false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && e.metaKey) {
      setShowSearch(false);
    } else if (e.key === 'Escape') {
      setShowSearch(false);
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <div className="search-modal" ref={searchRef}>
      <div className="search-modal-contents">
        <input
          className="search-input"
          type="text"
          value={search}
          onChange={handleSearch}
          autoFocus={true}
          placeholder="게임할 친구들을 찾아봐요~~!"
        />
        {searchResult.length > 0 && (
          <div className="search-results" ref={resultRef}>
            {searchResult.map((user, index) => {
              return (
                <div
                  key={index}
                  onKeyDown={e => {
                    console.log(e);
                    if (e.key === 'Enter') {
                      nav(`/profile/${user.userId}`);
                    }
                  }}
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
                    {/* <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
                    <span className="search-item-nickname">
                      {user.nickname}
                    </span>
                  </a>{' '}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchModal;
