import { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import instance from '../../util/Axios';
import SearchModalHeader from './SearchModalHeader';
import SearchModalBody from './SearchModalBody';
import SearchModalFooter from './SearchModalFooter';

const EMPTY_MSG = '유저의 닉네임을 입력해주세요.';
const ERROR_MSG = '오류가 발생하였습니다.';
const NOT_FOUND_MSG = '해당 유저가 존재하지 않습니다.';
const LENGTH_ERROR_MSG = '닉네임은 16자 이하로 입력해주세요.';

export interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

interface SearchModalProps {
  hideModal: () => void;
}

function SearchModal({ hideModal }: SearchModalProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>(EMPTY_MSG);
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    const { length } = e.target.value;
    if (length === 0 || length > 16) {
      setError(length === 0 ? EMPTY_MSG : LENGTH_ERROR_MSG);
      setSearchResult([]);
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
        setError(err.response?.status === 404 ? NOT_FOUND_MSG : ERROR_MSG);
      })
      .finally(() => {
        const { length } = e.target.value;
        if (length === 0 || length > 16) {
          setError(length === 0 ? EMPTY_MSG : LENGTH_ERROR_MSG);
          setSearchResult([]);
        }
        clearTimeout(timeout);
        setLoading(false);
      });
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (searchRef.current && searchRef.current === (e.target as Node)) {
      hideModal();
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.key === 'k' && e.metaKey) || e.key === 'Escape') {
      hideModal();
    }
  };

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
      <div className="searchModal regular">
        <SearchModalHeader
          query={query}
          loading={loading}
          handleSearch={handleSearch}
        />
        {error.length > 0 ? (
          <div className="searchModalError small">
            <div className="searchModalErrorMessage">{error}</div>
          </div>
        ) : (
          <SearchModalBody searchResult={searchResult} hideModal={hideModal} />
        )}
        <SearchModalFooter />
      </div>
    </div>
  );
}

export default SearchModal;
