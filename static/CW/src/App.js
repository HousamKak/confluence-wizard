import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';
import ApiKeyInput from './Components/Setup/ApiKeyInput.js';
import SearchingKeyMessage from './Components/Setup/SearchingKeyMessage.js';
import QuestionInput from './Components/QuestionArea/QuestionInput.js';
import ResponseDisplay from './Components/QuestionArea/ResponseDisplay.js';
import LoadingSpinner from './Components/Common/LoadingSpinner.js';
import Configurations from './Components/Setup/Configurations.js';

function App() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [checkingAPIKey, setCheckingAPIKey] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showChangeKeyInput, setShowChangeKeyInput] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await invoke('check_openai_key');
        if (response && response.hasKey) {
          setHasApiKey(true);
          setIsSetupComplete(true); // If the key is present, mark the setup as complete
        }
      } catch (error) {
        console.error('Error checking API key:', error);
      } finally {
        setCheckingAPIKey(false); // Whether API key is found or not, set this to false
      }
    };

    checkApiKey();
  }, []);



  const handleApiKeySave = async () => {
    try {
      const response = await invoke('store_openai_key', { openaiKey: apiKey });
      if (response && response.success) {
        setHasApiKey(true);
        setApiKey(''); // clear the input
      } else {
        setError(response.error || 'There was an issue saving your API key. Please try again.');
      }
    } catch (error) {
      console.error('Error storing API key:', error);
      setError('There was an issue saving your API key. Please try again.');
    }
  };


  const loadData = async () => {
    console.log('loadData function called.');
    try {
      setLoading(true); // Start the loading process
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
    } finally {
      setLoading(false); // End the loading process irrespective of success or error
    }
  };

  const questionAI = async (questionToAsk) => {
    console.log('questionAI function called with question:', questionToAsk);
    try {
      setAsking(true); // Start the asking process
      setError('');
      console.log('Sending question to AI...');
      const responseData = await invoke('question_to_gpt', { question: questionToAsk });
      console.log('Response from AI:', responseData);
      setResponse(responseData.answer);
      console.log(responseData.answer);
    } catch (e) {
      console.error(`An error occurred while questioning AI: ${e.message}`);
      setError('There was an issue processing your request. Please try again.');
    } finally {
      setAsking(false); // End the asking process irrespective of success or error
    }
  };

  const handleClick = async (e) => {
    e.preventDefault();
    console.log('handleClick function called.');
    await questionAI(question);
  };

  return (
    <div className="container">
      {!isSetupComplete ? (
        checkingAPIKey ? (
          <>
            <SearchingKeyMessage />
            <LoadingSpinner />
          </>
        ) : (
          <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} handleApiKeySave={handleApiKeySave} />
        )
      ) : isConfigOpen ? (
        <>
          <Configurations
            hasApiKey={hasApiKey}
            isDataLoaded={isDataLoaded}
            loading={loading}
            loadData={loadData}
            handleApiKeySave={handleApiKeySave}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showChangeKeyInput={showChangeKeyInput}
            setShowChangeKeyInput={setShowChangeKeyInput}
          />
          <button onClick={() => setIsConfigOpen(false)}>Go Back</button>
        </>
      ) : (
        <>
          <button onClick={() => setIsConfigOpen(true)}>Open Configurations</button>
          <p>Knowledge Base Loaded: {isDataLoaded ? 'Yes' : 'No'}</p>
          <QuestionInput
            question={question}
            setQuestion={setQuestion}
            handleClick={handleClick}
            asking={asking}
          />
          <ResponseDisplay response={response} error={error} />
        </>
      )}
    </div>
  );

}


export default App;

