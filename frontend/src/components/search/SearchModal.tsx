import { useEffect, useRef, useState } from 'react';
import instance from '../../util/Axios';
import SearchResult from './SearchResult';
import { AxiosError } from 'axios';
import '../../style/Search.css';

export interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

interface SearchModalProps {
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
}

function SearchModal({ setShowSearch }: SearchModalProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setLoading(true);
    if (e.target.value === '') {
      setLoading(false);
      setSearchResult([]);
      return;
    }
    instance
      .get(`/search?value=${e.target.value}`)
      .then(res => {
        setSearchResult(res.data);
        setError('');
      })
      .catch((err: AxiosError) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleClickOutside(e: MouseEvent) {
    if (searchRef.current && searchRef.current === (e.target as Node)) {
      setShowSearch(false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === 'k' && e.metaKey) || e.key === 'Escape') {
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
    <div className="searchModalBackground" ref={searchRef}>
      <div className="searchModal">
        <div className="searchModalHeader">
          <input /* header */
            className="search-input"
            type="text"
            value={query}
            onChange={handleSearch}
            autoFocus={true}
            placeholder="게임할 친구들을 찾아봐요~~!"
          />
        </div>
        <div className="searchModalBody">
          {renderError(query, error, searchResult, loading) /* body */ ??
            (query.length > 0 && (
              <SearchResult
                searchResult={searchResult}
                setShowSearch={setShowSearch}
              />
            ))}
        </div>
        <div className="searchModalFooter">
          <div>[엔터]: 검색 [방향키]: 네비 [esc]: 닫기 </div>
          {/* <div> 여기는 푸터랍니다~</div> */}
        </div>
      </div>
    </div>
  );
}

const renderError = (
  query: string,
  error: string,
  searchResult: Array<UserInfo>,
  loading: boolean,
) => {
  if (loading) {
    return (
      <div className="search-result-item">
        <div className="search-result-item-nickname">로딩중...</div>
      </div>
    );
  }
  if (error.length > 0) {
    return (
      <div className="search-result-item">
        <div className="search-result-item-nickname">{error}</div>
      </div>
    );
  }
  if (searchResult.length === 0) {
    return (
      <div className="search-result-item">
        <div className="search-result-item-nickname">
          {query.length === 0
            ? '유저의 닉네임을 입력해주세요.'
            : query.length > 16
            ? '닉네임은 16자 이하로 입력해주세요.'
            : ` ${query} 유저가 없습니다.`}
        </div>
      </div>
    );
  }
  return null;
};
export default SearchModal;
