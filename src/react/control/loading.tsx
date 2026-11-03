// PATH: frontend/src/react/control/loading.tsx
import React, { useEffect } from "react";

const Loading: React.FC = () => {
  useEffect(() => {
    const count = Number(document.body.dataset.loadingOverlayCount || 0) + 1;
    document.body.dataset.loadingOverlayCount = String(count);
    window.dispatchEvent(new Event("loading-overlay-change"));
    return () => {
      const nextCount = Math.max(0, Number(document.body.dataset.loadingOverlayCount || 1) - 1);
      if (nextCount === 0) delete document.body.dataset.loadingOverlayCount;
      else document.body.dataset.loadingOverlayCount = String(nextCount);
      window.dispatchEvent(new Event("loading-overlay-change"));
    };
  }, []);

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
