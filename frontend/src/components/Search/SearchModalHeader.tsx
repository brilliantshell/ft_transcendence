interface SearchModalHeaderProps {
  title: string;
  query: string;
  loading: boolean;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function SearchModalHeader({
  title,
  query,
  loading,
  handleSearch,
}: SearchModalHeaderProps) {
  return (
    <div className="searchModalHeader">
      <div className="searchModalHeaderForm selectNone">
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
          className="regular searchModalHeaderInput"
          type="text"
          value={query}
          onChange={handleSearch}
          autoFocus={true}
          placeholder={title}
        />
      </div>
    </div>
  );
}

export default SearchModalHeader;
