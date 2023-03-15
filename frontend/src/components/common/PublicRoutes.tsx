import axios from 'axios';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../util/Alert';
import { socket } from '../../util/Socket';
import Login from '../../views/Login';
import SignUp from '../../views/SignUp';
import ErrorBoundary from './ErrorBoundary';

const BASE_URL =
  import.meta.env.DEV === true ? 'http://localhost:3000/api' : '/api';

function PublicRoutes() {
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await axios.get(`${BASE_URL}/user/id`);
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
    <main>
      <ErrorBoundary fallback={'에러가 발생했어요~'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/sign-up" element={<SignUp />} />
        </Routes>
      </ErrorBoundary>
    </main>
  );
}

export default PublicRoutes;
