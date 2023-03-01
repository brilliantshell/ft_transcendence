import { ReactNode, useState } from 'react';
import '../../style/Modal.css';

interface Props {
  form : ReactNode;
  hidden: () => void;
  children?: ReactNode;
}

function FormModal({ form, hidden }: Props) {

  return (
    <div className="modal">
      <div className="modalOverlay" />
      <div className="modalContent">
        {form}
        {/* <div className="modalTitle">{title}</div> */}
      </div>
    </div>
  );
}

export default FormModal;
