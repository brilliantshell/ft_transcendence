import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Header from './components/common/Header';
import Main from './components/common/Main';
import Navigation from './components/common/Navigation';
import PublicRoutes from './components/common/PublicRoutes';

function AppWrapper() {
  const location = useLocation();
  const isPublicRoutes =
    location.pathname === '/login' ||
    location.pathname === '/sign-up' ||
    location.pathname === '/2fa';

  return (
    <>
      {isPublicRoutes ? (
        <PublicRoutes />
      ) : (
        <>
          <ErrorBoundary fallback={<header> 에러가 발생했어요~ </header>}>
            <Header />
          </ErrorBoundary>
          <Navigation />
          <ErrorBoundary fallback={<main> 에러가 발생했어요~ </main>}>
            <Suspense
              fallback={
                <main>
                  <div className="spin"></div>
                </main>
              }
            >
              <Main />
            </Suspense>
          </ErrorBoundary>
        </>
      )}
    </>
  );
}

export default AppWrapper;
