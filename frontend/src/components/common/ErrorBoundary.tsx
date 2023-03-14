import { AxiosError } from 'axios';
import { Component, ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../util/Alert';

interface Props {
  fallback?: ReactNode;
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidMount() {
    window.onunhandledrejection = error => {
      this.setState({ hasError: true });
    };

    window.onerror = error => {
      this.setState({ hasError: true });
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorAlert('오류가 발생하였습니다.', '잠시 후 다시 시도해주세요.');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
