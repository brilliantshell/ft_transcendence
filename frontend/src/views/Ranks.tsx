import UserBase from '../components/UserBase';
import MyRank from '../components/MyRank';
import { useEffect } from 'react';

function Right() {
  return <div>(role)</div>;
}

function Down() {
  return <div>down</div>;
}

function Ranks() {
  useEffect(() => {}, []);

  return (
    <>
      <UserBase userId={668} rightChild={<Right />} downChild={<Down />} />
      <br />
      <UserBase userId={668} rightChild={<Right />} />
      <br />
      <UserBase userId={668} downChild={<Down />} />
      <br />
      <UserBase userId={668} />
    </>
  );
}

export default Ranks;
