import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

export const ReactSwal = withReactContent(Swal).mixin({
  background: '#3d4f73', // primary_dark
  color: '#fff',
  customClass: {
    confirmButton: 'swal2-confirm-custom',
    denyButton: 'swal2-deny-custom',
    cancelButton: 'swal2-cancel-custom',
  },
});

export const SuccessAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'success',
    title,
    text,
  });
}

export const ErrorAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'error',
    title,
    text,
  });
}

export const ConfirmAlert = (title: string, text: string) => {
  return ReactSwal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
  });
}
