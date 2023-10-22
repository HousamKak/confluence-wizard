import React, { useState, useEffect } from 'react';

function ResponseDisplay({ response, error }) {
  const [displayedResponse, setDisplayedResponse] = useState("");
  const words = response.split(' ');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedResponse(prev => `${prev} ${words[index]}`);
      index++;
      if (index === words.length) clearInterval(interval);
    }, 200); // 500ms delay between words

    // Cleanup the interval if the component is unmounted
    return () => clearInterval(interval);
  }, [response]);

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      <p className="response-text">{displayedResponse}</p>
    </>
  );
}

export default ResponseDisplay;
