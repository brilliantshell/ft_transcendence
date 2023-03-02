import { ReactNode, useEffect, useRef } from 'react';
import '../../style/FormModal.css';

interface FormModalProps {
  title: string;
  form: ReactNode;
  hidden: () => void;
}

function FormModal({ title, form, hidden }: FormModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (e: MouseEvent) => {
    if (
      overlayRef.current &&
      overlayRef.current === (e.target as HTMLElement)
    ) {
      hidden();
    }
  };

  const handleEscKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hidden();
    }
  };

  const disableSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'k' && e.metaKey) {
      e.stopPropagation();
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscKeyDown);
    document.addEventListener('keydown', disableSearchKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscKeyDown);
      document.removeEventListener('keydown', disableSearchKeyDown, true);
    };
  }, []);

  return (
    <div className="formModal">
      <div className="formModalOverlay" ref={overlayRef} />
      <div className="formModalContent">
        <h2 className="formModalTitle xlarge"> {title}</h2>
        {form}
      </div>
    </div>
  );
}

export default FormModal;
