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
        안녕 여기는 검색 버튼 이란다
      </button>
      {showSearch && <SearchModal setShowSearch={setShowSearch} />}
    </div>
  );
}

export default Search;
