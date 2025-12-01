import React from "react";

const JoinCall: React.FC = () => {
  return (
    <div className="panel">
      <h1>Join an existing call</h1>
      <p>Enter the call ID you received or paste the invite link.</p>
      <form className="form">
        <label className="form-field">
          <span>Call ID</span>
          <input type="text" placeholder="abc-123" />
        </label>
        <label className="form-field">
          <span>Invite link</span>
          <input type="url" placeholder="https://t.me/your-bot?startapp=call-123" />
        </label>
        <button type="button">Join</button>
      </form>
    </div>
  );
};

export default JoinCall;
