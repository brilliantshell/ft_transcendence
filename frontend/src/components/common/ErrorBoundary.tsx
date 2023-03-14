import { Component, ErrorInfo, ReactNode } from 'react';
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
    window.addEventListener(
      'unhandledrejection',
      (error: PromiseRejectionEvent) => {
        this.setState({ hasError: true });
        error.preventDefault();
      },
    );

    window.addEventListener('error', (error: ErrorEvent) => {
      this.setState({ hasError: true });
      error.preventDefault();
    });
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorAlert('오류가 발생하였습니다.', '잠시 후 다시 시도해주세요.').then(
      () => {
        this.setState({ hasError: false });
      },
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
