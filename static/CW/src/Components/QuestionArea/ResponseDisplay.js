import React from 'react';

function ResponseDisplay({ question, response, error }) {
  return (
    <>
      <p>Question: {question}</p>
      {error && <p className="error-text">{error}</p>}
      <p>Response: {response}</p>
    </>
  );
}

export default ResponseDisplay;
