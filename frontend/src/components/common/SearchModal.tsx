import { useEffect, useRef, useState } from 'react';
import instance from '../../util/Axios';
import '../../style/Search.css';

interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

interface SearchModalProps {
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
}

function SearchModal({ setShowSearch }: SearchModalProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);

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
    } else if (e.key === 'ArrowDown') {
      console.log('ArrowDown');
      const firstItem = document.querySelector('.search-results-item');
      console.log(firstItem)
      if (firstItem) {
        (firstItem as HTMLElement).focus();
      }
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
          <div className="search-results">
            {searchResult.map((user, index) => {
              return (
                <div key={index} className="search-results-item">
                  <a href={`/profile/${user.userId}`}>
                    <img
                      src="http://localhost:5173/assets/defaultProfile"
                      width="36px"
                      height="36px"
                    />
                    {/* <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
                    <span>{user.nickname}</span>
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
