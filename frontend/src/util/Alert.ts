import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

export const ReactSwal = withReactContent(Swal).mixin({
  customClass: {
    popup: 'swal2PopupCustom',
    confirmButton: 'swal2ConfirmCustom',
    denyButton: 'swal2DenyCustom',
    cancelButton: 'swal2CancelCustom',
  },
});

export const SuccessAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'success',
    title,
    text,
  });
};

export const ErrorAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'error',
    title,
    html: `<p>${text}</p>`,
  });
};

export const ConfirmAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'question',
    title,
    html: `<p>${text}</p>`,
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
  });
};

export const InfoAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'info',
    title,
    html: `${text}`,
  });
};

export const InputAlert = (title: string, label: string) => {
  return ReactSwal.fire({
    title: `${title}`,
    input: 'text',
    inputLabel: `${label}`,
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
  });
};

export const FileAlert = (title: string) => {
  return ReactSwal.fire({
    title: `${title}`,
    input: 'file',
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
    inputAttributes: {
      accept:
        'image/jpeg, image/png, image/apng, image/avif, image/gif, image/webp',
      'aria-label': 'Upload your profile picture',
    },
  });
};

export const EmailAlert = (inputLabel: string) => {
  return ReactSwal.fire({
    title: '이메일을 입력하세요.',
    input: 'email',
    inputLabel: `${inputLabel}`,
    inputPlaceholder: '등록할 이메일을 입력해주세요.',
    confirmButtonText: '확인',
  });
};
