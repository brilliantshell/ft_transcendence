const BASE_URL =
  import.meta.env.DEV === true ? 'http://localhost:3000/api' : '/api';

function Login() {
  const handleClick = async () => {
    window.location.href = `${BASE_URL}/login/return`;
  };

  return (
    <div className="login">
      <button className="loginButton" onClick={handleClick}>
        로그인
      </button>
    </div>
  );
}

export default Login;
