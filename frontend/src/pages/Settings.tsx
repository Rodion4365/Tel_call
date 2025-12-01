import React from "react";

const Settings: React.FC = () => {
  return (
    <div className="panel">
      <h1>Settings</h1>
      <p>Configure the behavior of your Tel Call experience.</p>
      <div className="grid two-columns">
        <div className="card">
          <h2>Audio</h2>
          <p>Select microphone and speaker preferences.</p>
          <button type="button">Open audio settings</button>
        </div>
        <div className="card">
          <h2>Video</h2>
          <p>Adjust video quality, camera source, and background blur.</p>
          <button type="button">Open video settings</button>
        </div>
        <div className="card">
          <h2>Notifications</h2>
          <p>Control call reminders and push notifications.</p>
          <button type="button">Manage notifications</button>
        </div>
        <div className="card">
          <h2>Account</h2>
          <p>Link your Telegram account and view connected devices.</p>
          <button type="button">Open account</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
