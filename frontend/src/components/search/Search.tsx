import { useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import '../../style/Search.css';

function Search() {
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'k' && e.metaKey) {
      setShowSearch(true);
    }
  };

  const hideModal = () => {
    setShowSearch(false);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <>
      <button
        className="searchButton selectNone"
        onClick={() => setShowSearch(!showSearch)}
      >
        <img
          className="searchIcon"
          src="/assets/search-icon.svg"
          alt="search-icon"
        />
        <span>Search</span>
        <span className="xsmall">⌘+k</span>
      </button>
      {showSearch && <SearchModal hideModal={hideModal} />}
    </>
  );
}

export default Search;
