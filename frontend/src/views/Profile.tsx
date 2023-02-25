import { useParams } from 'react-router-dom';

function Profile() {
  const { id } = useParams();
  //   id === undefine이면 path="/"
  //   내 프로필 보여주면 된다.
  if (id !== undefined) {
    console.log(id);
  }

  return (
    <div>
      <h1>Profile</h1>
    </div>
  );
}

export default Profile;
