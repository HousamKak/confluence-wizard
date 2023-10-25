import React from 'react';
import LoadingSpinner from '../Common/LoadingSpinner.js';

const Configurations = ({
    hasApiKey,
    handleApiKeySave,
    handleApiKeyDelete,
    apiKey,
    setApiKey,
    showChangeKeyInput,
    setShowChangeKeyInput
}) => {
    return (
        <div className="configurations-container">
            <h2>Configurations</h2>

            <div className="api-key-section">
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
                    <>
                        <button onClick={() => setShowChangeKeyInput(true)} className="button">
                            Change API Key
                        </button>
                        {hasApiKey && (
                            <button onClick={handleApiKeyDelete} className="button delete-button">
                                Delete API Key
                            </button>
                        )}
                    </>
                )}
            </div>

        </div>
    );
};

export default Configurations;
