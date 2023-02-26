import { Suspense, useEffect, useRef, useState } from 'react';
import instance from '../../util/Axios';
import { AxiosError } from 'axios';
import SearchModalHeader from './SearchModalHeader';
import SearchResult from './SearchResult';
import SearchModalFooter from './SearchModalFooter';

export interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

interface SearchModalProps {
  hideModal: () => void;
}

const generateErrorElement = (
  query: string,
  error: string,
  searchResult: Array<UserInfo>,
) => {
  const elm = (msg: string) => (
    <div className="searchModalBody">
      <div className="searchModalBodyContents">
        <div className="searchModalBodyMessage">{msg}</div>
      </div>
    </div>
  );
  return error.length > 0
    ? elm(error)
    : query.length > 16
    ? elm('닉네임은 16자 이하로 입력해주세요.')
    : searchResult.length === 0
    ? elm('유저의 닉네임을 입력해주세요.')
    : null;
};

function SearchModal({ hideModal }: SearchModalProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (e.target.value.length === 0 || e.target.value.length > 16) {
      setSearchResult([]);
      setError('');
      setLoading(false);
      return;
    }
    const timeout = setTimeout(() => {
      setLoading(true);
    }, 300);
    instance
      .get(`/search?value=${e.target.value}`)
      .then(res => {
        setSearchResult(res.data);
        setError('');
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setError('해당 유저가 존재하지 않습니다.');
        } else {
          setError('오류가 발생하였습니다.');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setSearchResult([]);
        setLoading(false);
      });
  }

  function handleClickOutside(e: MouseEvent) {
    if (searchRef.current && searchRef.current === (e.target as Node)) {
      hideModal();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === 'k' && e.metaKey) || e.key === 'Escape') {
      hideModal();
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
        <SearchModalHeader
          query={query}
          loading={loading}
          handleSearch={handleSearch}
        />
        {generateErrorElement(query, error, searchResult) ?? (
          <SearchResult searchResult={searchResult} hideModal={hideModal} />
        )}
        <SearchModalFooter />
      </div>
    </div>
  );
}

export default SearchModal;
