import React from 'react';
import LoadingSpinner from '../Common/LoadingSpinner.js';

const Configurations = ({
    hasApiKey,
    isDataLoaded,
    loading,
    loadData,
    handleApiKeySave,
    apiKey,
    setApiKey,
    showChangeKeyInput,
    setShowChangeKeyInput
}) => {
    return (
        <div className="configurations-container">
            <h2>Configurations</h2>
            
            <div className="api-key-section">
                <p>API Key Status: {hasApiKey ? 'Configured' : 'Not Configured'}</p>

                {showChangeKeyInput ? (
                    <>
                        <label className="label">
                            Enter a new OpenAI API Key:
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="input"
                            />
                        </label>
                        <button onClick={handleApiKeySave} className="button">
                            Save New API Key
                        </button>
                    </>
                ) : (
                    <button onClick={() => setShowChangeKeyInput(true)} className="button">
                        Change API Key
                    </button>
                )}
            </div>
            
            <div className="load-data-section">
                <p>Knowledge Base Loaded: {isDataLoaded ? 'Yes' : 'No'}</p>
                <button onClick={loadData} disabled={isDataLoaded || loading} className="button">
                    {loading ? <LoadingSpinner /> : "Load Data"}
                </button>
            </div>
        </div>
    );
};

export default Configurations;
