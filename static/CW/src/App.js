import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';
import api, { route } from '@forge/api';
import ApiKeyInput from './Components/Setup/ApiKeyInput.js';
import SearchingKeyMessage from './Components/Setup/SearchingKeyMessage.js';
import QuestionInput from './Components/QuestionArea/QuestionInput.js';
import ResponseDisplay from './Components/QuestionArea/ResponseDisplay.js';
import LoadingSpinner from './Components/Common/LoadingSpinner.js';
import Configurations from './Components/Setup/Configurations.js';

function App() {

  // Controls main view
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Controls Api Keys dynamics
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingAPIKey, setCheckingAPIKey] = useState(true);

  // Controls knowledge data dynamics
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [checkingData, setCheckingData] = useState(false);

  // loader animation
  const [loading, setLoading] = useState(false);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showChangeKeyInput, setShowChangeKeyInput] = useState(false);


  // Those set the question and the response
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');

  // Control Space Keys
  const [selectedSpaceKey, setSelectedSpaceKey] = useState('');
  const [spaceKeyIsSelected, setSpaceKeyIsSelected] = useState(false);
  const [key, setKey] = useState('');


  // setting error message
  const [error, setError] = useState('');



  const isDataPreloaded = async () => {
    try {
      const response = await invoke('check_data_preloaded');
      if (response && response.Preloaded) {
        setIsSetupComplete(true);
      }
      return response && response.Preloaded;
    } catch (error) {
      console.error('Error checking if data is preloaded:', error);
      throw error; // Rethrow the error for retryOperation to catch
    }
  };

  const checkApiKey = async () => {
    const response = await invoke('check_openai_key');
    console.log(response)
    if (response && response.hasKey) {
      setHasApiKey(true);
      setCheckingAPIKey(false);
      setCheckingData(true)
    } else {
      setError('API key check failed')
      setCheckingAPIKey(false);
      throw new Error('API key check failed');
    }
  };
  const handleApiKeyDelete = async () => {
    try {
      const response = await invoke('delete_openai_key');
      if (response && response.success) {
        setCheckingAPIKey(false);
        setCheckingData(false)
        setHasApiKey(false);
        setShowChangeKeyInput(false);
        setIsSetupComplete(false)
        // setApiKey('');
        console.log('API key deleted successfully.');
      } else {
        setError(response.error || 'There was an issue deleting your API key. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      setError('There was an issue deleting your API key. Please try again.');
    }
  };

  const loadData = async () => {
    console.log('Attempting to fetch data...');
    const data = await invoke('get_and_index', { spaceKey: selectedSpaceKey });
    console.log('Data fetched:', data);
    if (!data.success) {
      throw new Error('Data fetching failed');
    } else {
      setIsDataLoaded(true);
      setIsSetupComplete(true);
    }
  };


  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const retryOperation = async (operation, maxAttempts = 3, delay = 1000) => {  // added a delay parameter with default value of 1000ms
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed. Retrying...`);
        if (attempt < maxAttempts - 1) {  // if it's not the last attempt, sleep
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
  };


  const onLoadApp = async () => {

    try {
      // Check for API key with retries
      await retryOperation(checkApiKey);

    } catch (error) {
      console.error('Error during app load:', error);
      setError('There was an issue initializing the app. Please refresh and try again.');
      setIsSetupComplete(false);
    } finally {
      setLoading(false);
    }

  };


  useEffect(() => {
    if (spaceKeyIsSelected) {
      onLoadApp();
    }
  }, [spaceKeyIsSelected]);

  useEffect(() => {
    (async () => {
      if (hasApiKey) {
        try {
          const dataPreloaded = await isDataPreloaded();
          if (!dataPreloaded) {
            await retryOperation(loadData);
          }
        }
        catch (e) {
          setError(e)
        }

      }
    })()
  }, [hasApiKey]);

  // Check if data is preloaded. If not, load it with retries

  const handleApiKeySave = async () => {
    try {
      const response = await invoke('store_openai_key', { openaiKey: apiKey });
      if (response && response.success) {
        setApiKey(''); // clear the input
        setCheckingAPIKey(false);
        setCheckingData(true);
        setHasApiKey(true);
        setShowChangeKeyInput(false);
      } else {
        setError(response.error || 'There was an issue saving your API key. Please try again.');
      }
    } catch (error) {
      console.error('Error storing API key:', error);
      setError('There was an issue saving your API key. Please try again.');
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
      {selectedSpaceKey ? (
        !isSetupComplete ? (
          checkingAPIKey ? (
            <>
              <SearchingKeyMessage />
              <LoadingSpinner />
            </>
          ) : checkingData ? (
            <>
              <p>Loading Confluence Content...</p>
              <LoadingSpinner />
            </>
          ) : (
            <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} handleApiKeySave={handleApiKeySave} />
          )
        ) : isConfigOpen ? (
          <>
            <Configurations
              hasApiKey={hasApiKey}
              handleApiKeySave={handleApiKeySave}
              handleApiKeyDelete={handleApiKeyDelete}
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
            <p className='declarative'>Ask Questions about Your knowledge base</p>
            <QuestionInput
              question={question}
              setQuestion={setQuestion}
              handleClick={handleClick}
              asking={asking}
            />
            <ResponseDisplay response={response} error={error} />
          </>
        )
      ) : (
        <>
          <p>Input a Confluence space key to proceed:</p>
          <input
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Enter your space key"
          />
          <button onClick={() => { setSpaceKeyIsSelected(true); setSelectedSpaceKey(key) }}>Submit</button>
        </>
      )
      }
    </div >
  );

}


export default App;

