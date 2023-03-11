interface ChannelAccessModeFieldProp {
  autoFocus: boolean;
  accessMode: string;
  handleAccessMode: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function ChannelAccessModeField({
  autoFocus,
  accessMode,
  handleAccessMode,
}: ChannelAccessModeFieldProp) {
  return (
    <label className="formModalField" htmlFor="accessMode">
      <p className="formModalFieldName">공개 범위</p>
      <div className="formModalFieldValue">
        <select
          className="formModalFieldInput"
          name="accessMode"
          value={accessMode}
          onChange={handleAccessMode}
          autoFocus={autoFocus}
        >
          <option value="public">공개</option>
          <option value="protected">공개 (비밀번호)</option>
          <option value="private">비공개</option>
        </select>
      </div>
    </label>
  );
}

export default ChannelAccessModeField;
