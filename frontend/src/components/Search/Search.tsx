import { useCallback, useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import { useNavigate } from 'react-router-dom';

function Search() {
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const nav = useNavigate();

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'k' && e.metaKey) {
      setShowSearch(true);
    }
  };

  const hideModal = useCallback(() => {
    setShowSearch(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  const searchAction = useCallback((targetId: number) => {
    nav(`/profile/${targetId}`);
    setShowSearch(false);
  }, []);

  return (
    <>
      <button
        className="searchButton selectNone"
        onClick={() => setShowSearch(true)}
      >
        <img
          className="searchIcon"
          src="/assets/search-icon.svg"
          alt="search-icon"
        />
        <span>Search</span>
        <span className="xsmall">⌘+k</span>
      </button>
      {showSearch && (
        <SearchModal
          title={'게임할 친구들을 찾아봐요~~!'}
          actionName={'검색'}
          searchAction={searchAction}
          hideModal={hideModal}
        />
      )}
    </>
  );
}

export default Search;
