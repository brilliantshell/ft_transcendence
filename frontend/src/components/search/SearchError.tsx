import { UserInfo } from "./SearchModal";

interface SearchErrorProps {
  error: string;
  query: string;
  searchResult: Array<UserInfo>;
}

function SearchError({ error, query, searchResult }: SearchErrorProps) {
  const elm = (msg: string) => (
    <div className="searchModalBodyContents">
      <div className="searchModalBodyMessage">{msg}</div>
    </div>
  );
  return error.length > 0
    ? elm(error)
    : query.length > 16
    ? elm('닉네임은 16자 이하로 입력해주세요.')
    : searchResult.length === 0
    ? elm('유저의 닉네임을 입력해주세요.')
    : null;
}

export default SearchError;
