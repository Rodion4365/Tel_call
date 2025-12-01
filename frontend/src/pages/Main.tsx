import React from "react";
import { Link } from "react-router-dom";

const CameraIcon: React.FC = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1.382l3.105 1.553A1 1 0 0 0 20 15.277V8.723a1 1 0 0 0-1.895-.894L15 9.382V8a2 2 0 0 0-2-2Z" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg className="settings-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10.325 4.317a1.8 1.8 0 0 1 3.35 0l.3.785a1.8 1.8 0 0 0 2.115 1.11l.812-.203a1.8 1.8 0 0 1 2.158 1.176l.5 1.55a1.8 1.8 0 0 1-1.047 2.21l-.754.316a1.8 1.8 0 0 0-.99 2.232l.256.76a1.8 1.8 0 0 1-1.4 2.333l-1.594.27a1.8 1.8 0 0 1-1.935-1.007l-.322-.692a1.8 1.8 0 0 0-2.65-.727l-.65.455a1.8 1.8 0 0 1-2.587-.66l-.745-1.381a1.8 1.8 0 0 1 .64-2.383l.676-.425a1.8 1.8 0 0 0 .66-2.36l-.37-.735a1.8 1.8 0 0 1 .813-2.428zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5" />
  </svg>
);

const Main: React.FC = () => {
  return (
    <div className="main-screen">
      <header className="main-header">
        <h1 className="main-title">Звонки</h1>
        <Link to="/settings" className="settings-button" aria-label="Настройки">
          <SettingsIcon />
        </Link>
      </header>

      <div className="main-actions">
        <Link className="action-button action-primary" to="/create-call">
          <CameraIcon />
          <span>Создать звонок</span>
        </Link>
        <Link className="action-button action-secondary" to="/join-call">
          <span>Присоединиться к звонку</span>
        </Link>
      </div>
    </div>
  );
};

export default Main;
