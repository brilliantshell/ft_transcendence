import { useState } from "react";
import instance from "../../util/Axios";
import "../../style/search.css";


interface UserInfo {
  userId: number;
  nickname: string;
  isDefaultImage: boolean;
}

function Search() {
  const [search, setSearch] = useState<string>('');
  const [searchResult, setSearchResult] = useState<Array<UserInfo>>([]);
  
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    if (e.target.value === '') {
      setSearchResult([]);
      return;
    }
    instance.get(`/search?search=${e.target.value}`)
      .then(res => {
        setSearchResult(res.data);
      }
    );

  }
  
  return (
    <div className="search">
        <input className='search-input' type="text" value={search} onChange={handleSearch} placeholder='게임할 친구들을 찾아봐요~~!' />
      { searchResult.length > 0 &&
      <div>
        {searchResult.map((user, index) => {
          return (
            <div key={index} className='search-result'>
              <img src= 'http://localhost:5173/assets/defaultProfile' width='24px' height='24px'/>
              {/* <img src={user.isDefaultImage ? 'http://localhost:5173/assets/defaultProfile'  : `http://localhost:3000/asset/profile-image/${user.userId}`}/> */}
              <span>{user.nickname}</span>
              </div>)})}
      </div>}
    </div>
  );
}

export default Search;
