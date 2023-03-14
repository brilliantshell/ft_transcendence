import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import Header from './components/common/Header';
import Main from './components/common/Main';
import Navigation from './components/common/Navigation';
import UserIdInput from './UserIdInput.test';
import ErrorBoundary from './components/common/ErrorBoundary';
import './style/App.css';

function App() {
  return (
    <RecoilRoot>
      {import.meta.env.DEV === true &&
        sessionStorage.getItem('x-user-id') === null && <UserIdInput />}
      <BrowserRouter>
        <ErrorBoundary fallback={<header> 에러가 발생했어요~ </header>}>
          <Header />
        </ErrorBoundary>
          <Navigation />
        <ErrorBoundary fallback={<main> 에러가 발생했어요~ </main>}>
          <Suspense fallback={<div>Loading...</div>}>
            <Main />
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </RecoilRoot>
  );
}

export default App;
