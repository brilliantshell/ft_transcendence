import { memo } from 'react';

interface SearchModalFooterProps {
  actionName: string;
}

function SearchModalFooter({ actionName }: SearchModalFooterProps) {
  return (
    <div className="searchModalFooter selectNone small">
      <span>
        <span> ↩ : {actionName} </span> <span> ↑↓ : 이동 </span>
      </span>
      <span>Powered By 기절초퐁</span>
    </div>
  );
}

export default memo(SearchModalFooter);
