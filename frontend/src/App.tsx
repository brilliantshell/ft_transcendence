import { BrowserRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import UserIdInput from './UserIdInput.test';
import AppWrapper from './AppWrapper';
import './style/App.css';

function App() {
  return (
    <RecoilRoot>
      {import.meta.env.DEV === true &&
        sessionStorage.getItem('x-user-id') === null && <UserIdInput />}
      <BrowserRouter>
        <AppWrapper />
      </BrowserRouter>
    </RecoilRoot>
  );
}

export default App;
