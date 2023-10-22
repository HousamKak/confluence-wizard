import React from 'react';
import LoadingSpinner from '../Common/LoadingSpinner.js';

function QuestionInput({ question, setQuestion, handleClick, asking }) {
  return (
    <>
      <label className="label" htmlFor="questionTextarea">
      </label>
      <textarea
        id="questionTextarea"
        placeholder="Type your question..."  // This sets the placeholder text inside the textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="textarea"
      />
      <button onClick={handleClick} disabled={asking} className="button">
        {asking ? <LoadingSpinner /> : ("Ask")}
      </button>
    </>
  );
}

export default QuestionInput;

