import React from "react";

const CreateCall: React.FC = () => {
  return (
    <div className="panel">
      <h1>Create a new call</h1>
      <p>Set up a new call room and share the link with teammates.</p>
      <form className="form">
        <label className="form-field">
          <span>Call topic</span>
          <input type="text" placeholder="Weekly sync" />
        </label>
        <label className="form-field">
          <span>Visibility</span>
          <select>
            <option>Private</option>
            <option>Public</option>
          </select>
        </label>
        <button type="button">Generate call link</button>
      </form>
    </div>
  );
};

export default CreateCall;
