interface ChannelPasswordFieldProps {
  password: string | undefined;
  error: boolean;
  handlePassword: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PWD_ERR = '비밀번호는 8~16자로 입력해주세요';

function ChannelPasswordField({
  password,
  error,
  handlePassword,
}: ChannelPasswordFieldProps) {
  return (
    <label className="formModalField" htmlFor="password">
      <p className="formModalFieldName">비밀번호</p>
      <div className="formModalFieldValue">
        <input
          className="formModalFieldInput"
          type="password"
          name="password"
          autoFocus={true}
          value={password}
          onChange={handlePassword}
        />
        {error && (
          <span className="formModalFieldError xsmall"> {PWD_ERR} </span>
        )}
      </div>
    </label>
  );
}

export default ChannelPasswordField;
