import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import Header from './components/common/Header';
import Main from './components/common/Main';
import Navigation from './components/common/Navigation';
import './style/App.css';

function App() {
  return (
    <RecoilRoot>
      <BrowserRouter>
        <Header />
        <Navigation />
        <Suspense fallback={<div>Loading...</div>}>
          <Main />
        </Suspense>
      </BrowserRouter>
    </RecoilRoot>
  );
}

export default App;
