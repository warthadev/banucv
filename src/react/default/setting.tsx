// src/react/default/setting.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SettingAudio from './settingaudio';
import SettingVisual from './settingvisual';
import SettingUser from './settinguser';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="settings-page-container">
      <main className="content-wrapper">
        
        {/* Header */}
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

        {/* User Profile & Credentials */}
        <SettingUser />
        
        {/* Pengaturan Visual */}
        <SettingVisual />
        
        {/* Pengaturan Audio */}
        <SettingAudio />

        {/* Footer */}
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