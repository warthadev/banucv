// src/react/default/setting.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SettingAudio from './settingaudio';
import SettingVisual from './settingvisual';
import SettingUser from './settinguser';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const isSettingsLoading = isProfileLoading;

  return (
    <div className="settings-page-container global-page">
      <main className="content-wrapper global-wrapper" aria-busy={isSettingsLoading}>
        <header className="settings-header">
          <div className="header-left">
            <h1 className="header-title"><span>Control Center</span></h1>
            <p className="header-subtitle"><span>Personalize your experience</span></p>
          </div>
          <button
            className="back-button-right"
            onClick={() => navigate(-1)}
            type="button"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        </header>

        {isSettingsLoading && (
          <div className="stack-item settings-page-loading global-card global-card--padded" role="status" aria-label="Loading" aria-live="polite" aria-busy="true">
            <div className="su-loading-container">
              <div className="status-spinner" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="settings-all-content" hidden={isSettingsLoading} aria-hidden={isSettingsLoading}>
          <SettingUser onLoadingChange={setIsProfileLoading} />
          <SettingVisual />
          <SettingAudio />
        </div>

        <footer className="settings-footer">
          <div className="footer-status">
            <div className="status-dot"></div>
            <span>WARTHADEV SYSTEM READY</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default SettingsPage;
