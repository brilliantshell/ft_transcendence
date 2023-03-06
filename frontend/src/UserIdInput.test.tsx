import { useRef, useState } from 'react';
import instance from './util/Axios';

export default function UserIdInput() {
  const [isSet, setIsSet] = useState(
    sessionStorage.getItem('x-user-id') !== null,
  );
  const inputRef = useRef(null);

  return (
    <>
      {!isSet && (
        <div className="userIdModal">
          <input ref={inputRef} className="userIdInput" placeholder="User ID" />
          <button
            className="userIdButton"
            type="button"
            onClick={() => {
              if (inputRef.current === null) return;
              const userId = (inputRef.current as HTMLInputElement).value;
              if (userId.length === 5 && !isNaN(Number(userId))) {
                sessionStorage.setItem('x-user-id', userId);
                setIsSet(true);
                instance.defaults.headers.common['x-user-id'] = userId;
              }
            }}
          >
            SUBMIT
          </button>
        </div>
      )}
    </>
  );
}
