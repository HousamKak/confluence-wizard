import React, { useState } from 'react';
import { invoke } from '@forge/bridge';

function App() {
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setError('');
      const data = await invoke('fetchAllConfluenceData', { spaceKey: 'CO' });
      setKnowledgeBase(data);

      const backendResponse = await invoke('index_and_train', { data });

      if (!backendResponse.success) {
        setError('There was an issue fetching the data. Please try again.');
      } else {
        console.log("Data indexed successfully on backend");
      }
    } catch (e) {
      console.error(`An error occurred while loading data: ${e.message}`);
      setError('There was an issue fetching the data. Please try again.');
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await questionAI(question);
  };

  return (
    <div>
      <button onClick={loadData} disabled={knowledgeBase.length > 0}>Load Data</button>
      <p>Knowledge Base Loaded: {knowledgeBase.length > 0 ? 'Yes' : 'No'}</p>
        <label>
          Type your question:
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <button onClick={handleFormSubmit} type="submit">Ask</button>
      {error && <p>{error}</p>}
      <p>Response: {response}</p>
    </div>
  );
}

// // return (
// //   <div>
// //     <button onClick={loadData} disabled={knowledgeBase.length > 0}>Load Data</button>
// //     <p>Knowledge Base Loaded: {knowledgeBase.length > 0 ? 'Yes' : 'No'}</p>
// //     <form onSubmit={handleFormSubmit}>
// //       <label>
// //         Type your question:
// //         <textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
// //       </label>
// //       <button type="submit">Ask</button>
// //     </form>
// //     {error && <p>{error}</p>}
// //     <p>Response: {response}</p>
// //   </div>
// // );

export default App;

// import React, { useEffect, useState } from 'react';
// import { invoke } from '@forge/bridge';

// function App() {
//   const [data, setData] = useState(null);

//   useEffect(() => {
//     invoke('getText', { example: 'my-invoke-variable' }).then(setData);
//   }, []);

//   return (
//     <>
//       <div>
//         {data ? data : 'Loading...'}
//       </div>
//       <div>
//         <p>hello</p>
//       </div>
//     </>
//   );
// }

// export default App;