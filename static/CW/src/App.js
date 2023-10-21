import React, { useState } from 'react';
import { invoke } from '@forge/bridge';

function App() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setError('');
      const data = await invoke('get_and_index', { spaceKey: 'CO' });
      if (!data.success) {
        setError('There was an issue fetching the data. Please try again.');
      } else {
        setIsDataLoaded(true);
        console.log("Data indexed successfully on backend");
      }
    } catch (e) {
      console.error(`An error occurred while loading data: ${e.message}`);
      setError('There was an issue cc fetching the data. Please try again.');
    }
  };

  const questionAI = async (questionToAsk) => {
    try {
      setError('');
      const responseData = await invoke('question_to_gpt', { question: questionToAsk });
      setResponse(responseData.answer);
    } catch (e) {
      console.error(`An error occurred while questioning AI: ${e.message}`);
      setError('There was an issue processing your request. Please try again.');
    }
  };

  const handleClick = async () => {
    await questionAI(question);
  };

  return (
    <div>
      <button onClick={loadData} disabled={isDataLoaded}>Load Data</button>
      <p>Knowledge Base Loaded: {isDataLoaded ? 'Yes' : 'No'}</p>
      <label>
        Type your question:
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
      </label>
      <button onClick={handleClick} type="submit">Ask</button>
      {error && <p>{error}</p>}
      <p>Response: {response}</p>
    </div>
  );
}


export default App;
