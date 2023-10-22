import React, { useState } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    console.log('loadData function called.');
    try {
      setError('');
      console.log('Attempting to fetch data...');
      const data = await invoke('get_and_index', { spaceKey: 'CO' });
      console.log('Data fetched:', data);
      if (!data.success) {
        setError('There was an issue fetching the data. Please try again.');
      } else {
        setIsDataLoaded(true);
        console.log(data.status);
      }
    } catch (e) {
      console.error(`An error occurred while loading data: ${e.message}`);
      setError('There was an issue cc fetching the data. Please try again.');
    }
  };

  const questionAI = async (questionToAsk) => {
    console.log('questionAI function called with question:', questionToAsk);
    try {
      setError('');
      console.log('Sending question to AI...');
      const responseData = await invoke('question_to_gpt', { question: questionToAsk });
      console.log('Response from AI:', responseData);
      setResponse(responseData.answer);
      console.log(responseData.answer);
    } catch (e) {
      console.error(`An error occurred while questioning AI: ${e.message}`);
      setError('There was an issue processing your request. Please try again.');
    }
  };

  const handleClick = async (e) => {
    e.preventDefault();
    console.log('handleClick function called.');
    await questionAI(question);
  };

  return (
    <div className="container">
      <button onClick={loadData} disabled={isDataLoaded} className="button">Load Data</button>
      <p>Knowledge Base Loaded: {isDataLoaded ? 'Yes' : 'No'}</p>
      <label className="label">
        Type your question:
        <textarea value={question} onChange={(e) => {
          console.log('Question textarea value changed.');
          setQuestion(e.target.value);
        }} className="textarea" />
      </label>
      <button onClick={handleClick} className="button">Ask</button>
     <p>Question: {question}</p>
      {error && <p className="error-text">{error}</p>}
      <p>Response: {response}</p>
    </div>
  );
}

export default App;
