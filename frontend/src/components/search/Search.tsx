import { useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import '../../style/Search.css';

function Search() {
  const [showSearch, setShowSearch] = useState<boolean>(false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && e.metaKey) {
      setShowSearch(true);
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <div className="search">
      <button
        className="searchButton"
        onClick={() => setShowSearch(!showSearch)}
      >
      <img src='/assets/search-icon.svg' alt='search-icon' className='searchIcon' />
      <span>Search</span>
      <span className='searchKeyIcon'><kbd>⌘</kbd><kbd>k</kbd></span>
      </button>
      {showSearch && <SearchModal setShowSearch={setShowSearch} />}
    </div>
  );
}

export default Search;
