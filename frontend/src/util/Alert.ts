import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import '../style/presets/Alert.css';

export const ReactSwal = withReactContent(Swal).mixin({
  customClass: {
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
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
  });
};
