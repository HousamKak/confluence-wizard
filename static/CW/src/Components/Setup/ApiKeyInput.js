import React from 'react';

function ApiKeyInput({ apiKey, setApiKey, handleApiKeySave }) {
  return (
    <>
      <p>No API key registered found, please add an OpenAI API key.</p>
      <label className="label">
        Enter your OpenAI API Key:
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input"
        />
      </label>
      <button onClick={handleApiKeySave} className="button">Save API Key</button>
    </>
  );
}

export default ApiKeyInput;
