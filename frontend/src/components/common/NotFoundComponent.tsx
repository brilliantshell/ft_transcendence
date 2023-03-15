import { ErrorAlert } from '../../util/Alert';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function NotFoundComponent() {
  const nav = useNavigate();
  useEffect(() => {
    ErrorAlert('잘못된 접근입니다.', '프로필 페이지로 이동합니다.').then(() =>
      nav('/', { replace: true }),
    );
  }, []);
  return <></>;
}
