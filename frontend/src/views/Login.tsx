import axios from 'axios';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../util/Alert';
import { socket } from '../util/Socket';
import '../style/Login.css';

const BASE_URL =
  import.meta.env.DEV === true ? 'http://localhost:3000/api' : '/api';

function Login() {
  const nav = useNavigate();

  const handleClick = async () => {
      window.location.href = `${BASE_URL}/login/return`;
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${BASE_URL}/user/id`);
        if (data.userId === null) {
          return;
        }
        nav('/', { replace: true });
      } catch (err: any) {
        if (err?.response?.status === 401) {
          return;
        }
        ErrorAlert('오류가 발생했습니다.', '잠시 후 다시 시도해주세요.');
      }
    })();

    socket.off();
  }, []);

  return (
    <div className="login">
      <button className="loginButton" onClick={handleClick}>
        로그인
      </button>
    </div>
  );
}

export default Login;
