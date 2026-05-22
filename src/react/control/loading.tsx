import React from "react";

const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-ring"></div>
        <span className="loading-text">Initializing</span>
      </div>
    </div>
  );
};

export default Loading;