// PATH: frontend/src/react/control/loading.tsx
import React from "react";

const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-ring"></div>
        <div className="loading-text-wrapper">
          <span className="loading-text">INITIALIZING</span>
        </div>
      </div>
    </div>
  );
};

export default Loading;