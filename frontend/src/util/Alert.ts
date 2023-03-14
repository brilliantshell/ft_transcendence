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
    // text: `${text}`,
  });
};

export const InputAlert = (title: string, label: string) => {
  return ReactSwal.fire({
    title: `${title}`,
    input: 'text',
    inputLabel: `${label}`,
    showCancelButton: true,
  });
};

export const FileAlert = (title: string) => {
  return ReactSwal.fire({
    title: `${title}`,
    input: 'file',
    showCancelButton: true,
    inputAttributes: {
      accept: 'image/*',
      'aria-label': 'Upload your profile picture',
    },
  });
};
