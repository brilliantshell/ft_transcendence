import { useRef, useState } from 'react';
import instance from '../../util/Axios';

function ChangeNickname() {
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <button className="menuButton changeNicknameButton" onClick={openModal}>
        <span className="menuTooltip">Change Nickname</span>
      </button>
      {isOpen && (
        <div className="ProfileModal">
          <div>
            <input
              type="text"
              className="nickInput"
              placeholder="New Nickname"
              ref={inputRef}
            />
          </div>
          <button
            className="submitNick"
            onClick={() => {
              if (inputRef.current === null) return;
              const newNick = (inputRef.current as HTMLInputElement).value;
              if (newNick.length < 10) {
                instance
                  .patch(`/profile/nickname`, { nickname: newNick })
                  .then()
                  .catch();
              }
            }}
          >
            SUBMIT
          </button>
          <span className="close" onClick={closeModal}>
            &times;
          </span>
        </div>
      )}
    </div>
  );
}

function UploadImage() {
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <button
        className="menuButton uploadProfileImageButton"
        onClick={openModal}
      >
        <span className="menuTooltip">Upload Image</span>
      </button>
      {isOpen && (
        <div className="ProfileModal">
          <div className="ProfileModalContent">
            <input type="file" className="nickInput" ref={inputRef} />
            <button
              className="submitNick"
              onClick={() => {
                if (inputRef.current === null) return;
                const newImage = (inputRef.current as HTMLInputElement).value;
                instance.put(`/profile/image`, { newImage }).then().catch();
              }}
            >
              UPLOAD
            </button>
            <span className="close" onClick={closeModal}>
              &times;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteImage() {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <button
        className="menuButton deleteProfileImageButton"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <span className="menuTooltip">Delete Image</span>
      </button>
      {isOpen && (
        <div className="ProfileModal">
          <button
            className="submitNick"
            onClick={() => {
              instance.delete(`/profile/image`).then().catch();
            }}
          >
            DELETE
          </button>
          <span className="close" onClick={closeModal}>
            &times;
          </span>
        </div>
      )}
    </div>
  );
}

function TwoFASetting() {
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <button className="menuButton setTwoFAButton" onClick={openModal}>
        <span className="menuTooltip">2FA Setting</span>
      </button>
      {isOpen && (
        <div className="ProfileModal">
          <div className="ProfileModalContent">
            <input
              type="file"
              className="nickInput"
              placeholder="Find"
              ref={inputRef}
            />
            <button
              className="submitNick"
              onClick={() => {
                instance.delete(`/profile/image`).then().catch();
              }}
            >
              DELETE
            </button>
            <span className="close" onClick={closeModal}>
              &times;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuBarWrapper() {
  return (
    <p className="profileItem menuBar">
      <ChangeNickname />
      <UploadImage />
      <DeleteImage />
      <TwoFASetting />
    </p>
  );
}

function ProfileMenuBar(props: { userId: number | null }) {
  return (
    (props.userId && <MenuBarWrapper />) || (
      <div className="profileItem">Another User's Profile</div>
    )
  );
}

export default ProfileMenuBar;
