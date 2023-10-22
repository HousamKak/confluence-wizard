import React from 'react';

function QuestionInput({ question, setQuestion, handleClick, asking }) {
  return (
    <>
      <label className="label">
        Type your question:
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="textarea" />
      </label>
      <button onClick={handleClick} disabled={asking} className="button">
        {asking ? (<span className="loader"></span>) : ("Ask")}
      </button>
    </>
  );
}

export default QuestionInput;
