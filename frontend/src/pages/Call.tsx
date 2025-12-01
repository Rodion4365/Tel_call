import React from "react";
import { useParams } from "react-router-dom";

const Call: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="panel">
      <h1>Call room</h1>
      <p>This screen will host the WebRTC call UI.</p>
      <div className="call-info">
        <p>
          <strong>Room ID:</strong> {id ?? "not specified"}
        </p>
        <p>Use this area to show participant list, audio controls, and connection status.</p>
      </div>
    </div>
  );
};

export default Call;
