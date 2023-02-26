interface SearchModalHeaderProps {
  query: string;
  loading : boolean;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function SearchModalHeader ({query, loading, handleSearch} : SearchModalHeaderProps) {
  return (
        <div className="searchModalHeader">
          <div className="searchModalHeaderForm">
            {loading ? (
              <div className="searchModalHeaderSpin"></div>
            ) : (
              <img
                className="searchModalHeaderIcon"
                src="/assets/search-icon-secondary.svg"
                alt="search-icon"
              />
            )}
            <input
              className="searchModalHeaderInput"
              type="text"
              value={query}
              onChange={handleSearch}
              autoFocus={true}
              placeholder="게임할 친구들을 찾아봐요~~!"
            />
          </div>
        </div>
  );
}

export default SearchModalHeader;
