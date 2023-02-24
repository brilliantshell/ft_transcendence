import { useState } from 'react';
import SearchModal from './SearchModal';

function Search() {
  const [showSearch, setShowSearch] = useState<boolean>(false);

  return (
    <div className="search">
      <button className="search-btn" onClick={() => setShowSearch(!showSearch)}>
        안녕 여기는 검색 버튼 이란다
      </button>
      {showSearch && <SearchModal setShowSearch={setShowSearch} />}
    </div>
  );
}

export default Search;
