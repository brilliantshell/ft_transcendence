import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../util/Alert';

const ALLOWED_MIME_TYPES =
  'image/jpeg, image/png, image/apng, image/avif, image/gif, image/webp';

function SignUp() {
  const [nickname, setNickname] = useState<string>('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [error, setError] = useState<boolean>(true);
  const nav = useNavigate();

  const handleNickname = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.validity.valid || e.target.value.length === 0) {
      setError(true);
    } else {
      setError(false);
    }
    setNickname(e.target.value);
  };

  const handleProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setProfileImage(e.target.files[0]);
      setProfileImageUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (error || nickname === '') {
      return ErrorAlert(
        '회원가입 실패',
        '닉네임은 4 ~ 10자의 영문자로 입력해주세요.',
      );
    }
    const formData = new FormData();
    formData.append('nickname', nickname);
    profileImage && formData.append('profileImage', profileImage);
    axios
      .post(
        import.meta.env.DEV === true
          ? 'http://localhost:3000/api/login/user-info'
          : '/api/login/user-info',
        formData,
      )
      .then(() => nav('/'))
      .catch(err => {
        if (err.response.status === 409) {
          ErrorAlert('회원가입 실패', '이미 존재하는 닉네임입니다.');
        } else if (err.response.status === 413) {
          ErrorAlert(
            '회원가입 실패',
            '프로필 이미지는 4MB 이하로 등록해주세요.',
          );
        } else if (err.response.status === 401) {
          ErrorAlert(
            '로그인 세션이 만료되었니다.',
            '다시 로그인 뒤 진행해주세요.',
          ).then(() => nav('/login', { replace: true }));
        } else if (err.response.status >= 500) {
          ErrorAlert('회원가입 실패', '서버에 문제가 발생했습니다.');
        }
      });
  };

  return (
    <div className="signUp">
      <form className="signUpForm" method="post" onSubmit={handleSubmit} noValidate>
        <label className="signUpImage" htmlFor="profileImage">
          <div className="signUpImageFrame">
            <EditSvg />
            <img
              className="signUpImagePreview"
              src={profileImageUrl || '/assets/defaultProfile.svg'}
              alt="uploaded profile image preview"
            />
            <input
              className="hidden"
              type="file"
              accept={ALLOWED_MIME_TYPES}
              id="profileImage"
              name="profileImage"
              onChange={handleProfileImage}
            />
          </div>
          <p className="signUpImageDescription small">
            4mb 이하 {ALLOWED_MIME_TYPES.split('image/')} 파일만 가능합니다.
          </p>
        </label>
        <label className="signUpNickname" htmlFor="nickname">
          <input
            className="signUpNicknameInput xlarge"
            type="text"
            name="nickname"
            value={nickname}
            onChange={handleNickname}
            pattern="[a-zA-Z]{4,10}"
            autoComplete="off"
            autoFocus={true}
            placeholder="닉네임을 입력해주세요."
          />
          <p className="signUpNicknameError selectNone small">
            {error && '닉네임은 4 ~ 10자의 영문자로 입력해주세요.'}
          </p>
        </label>
        <button className="signUpButton xlarge" type="submit">
          회원가입
        </button>
      </form>
    </div>
  );
}

function EditSvg() {
  return (
    <svg
      className="signUpImageEdit"
      width="2.5rem"
      height="2.5rem"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.9445 14.1875L9.94446 10.1875M13.9445 14.1875L8.946 19.1859C8.28735 19.8446 7.48784 20.3646 6.56993 20.5229C5.64311 20.6828 4.49294 20.736 3.94444 20.1875C3.39595 19.639 3.44915 18.4888 3.609 17.562C3.76731 16.6441 4.28735 15.8446 4.946 15.1859L9.94446 10.1875M13.9445 14.1875C13.9445 14.1875 16.9444 11.1875 14.9444 9.1875C12.9444 7.1875 9.94446 10.1875 9.94446 10.1875M3.5 12C3.5 5.5 5.5 3.5 12 3.5C18.5 3.5 20.5 5.5 20.5 12C20.5 18.5 18.5 20.5 12 20.5"
        stroke="var(--primary_dark)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default SignUp;
