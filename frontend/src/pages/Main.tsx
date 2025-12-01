import React from "react";
import { Link } from "react-router-dom";

const Main: React.FC = () => {
  return (
    <div className="panel">
      <h1>Welcome to Tel Call</h1>
      <p>
        This is the landing screen for the Telegram Mini App. Use the quick actions below to
        navigate through the core flows.
      </p>
      <div className="grid">
        <Link className="card" to="/create-call">
          <h2>Create a call</h2>
          <p>Generate a new call room and invite participants.</p>
        </Link>
        <Link className="card" to="/join-call">
          <h2>Join a call</h2>
          <p>Enter a call ID or follow an invite link to connect.</p>
        </Link>
        <Link className="card" to="/settings">
          <h2>Settings</h2>
          <p>Manage your audio/video preferences and account details.</p>
        </Link>
      </div>
    </div>
  );
};

export default Main;
