// src/react/default/setting.tsx
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, LoaderCircle, Save } from 'lucide-react';
import SettingAudio from './settingaudio';
import SettingVisual from './settingvisual';
import SettingUser from './settinguser';
import SettingAgent from './settingagent';
import type { RegisterSettingsSaveHandler, SettingsSaveHandler, SettingsSaveResult, SettingsSaveSectionId } from './settingssave';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [saveHandlers, setSaveHandlers] = useState<Partial<Record<SettingsSaveSectionId, SettingsSaveHandler>>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveResults, setSaveResults] = useState<SettingsSaveResult[] | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isOpenRouterLoading, setIsOpenRouterLoading] = useState(true);
  const isSettingsLoading = isProfileLoading || isOpenRouterLoading;

  const registerSaveHandler = useCallback<RegisterSettingsSaveHandler>((sectionId, handler) => {
    setSaveHandlers((current) => {
      if (handler) return { ...current, [sectionId]: handler };
      if (!current[sectionId]) return current;
      const next = { ...current };
      delete next[sectionId];
      return next;
    });
  }, []);

  const clearSaveSummary = useCallback(() => setSaveResults(null), []);

  const handleSaveAll = async () => {
    if (isSavingAll) return;
    const entries: [SettingsSaveSectionId, SettingsSaveHandler][] = [];
    for (const sectionId of ['github', 'openrouter'] as const) {
      const handler = saveHandlers[sectionId];
      if (handler) entries.push([sectionId, handler]);
    }
    if (!entries.length) return;

    setIsSavingAll(true);
    setSaveResults(null);
    try {
      const results: SettingsSaveResult[] = [];
      for (const [sectionId, handler] of entries) {
        try {
          results.push(await handler());
        } catch {
          const sectionName = sectionId === 'github' ? 'GitHub' : 'AI Agent · OpenRouter';
          results.push({ sectionId, sectionName, status: 'error', message: 'Unexpected error while saving.' });
        }
      }
      setSaveResults(results);
    } finally {
      setIsSavingAll(false);
    }
  };

  const allUnchanged = Boolean(saveResults?.length && saveResults.every((result) => result.status === 'unchanged'));
  const hasSaveErrors = Boolean(saveResults?.some((result) => result.status === 'error'));

  return (
    <div className="settings-page-container">
      <main className="content-wrapper" aria-busy={isSettingsLoading}>
        
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

        {/* Keep all settings hidden until profile and OpenRouter settings are ready. */}
        {isSettingsLoading && (
          <div className="stack-item settings-page-loading" role="status" aria-label="Loading" aria-live="polite" aria-busy="true">
            <div className="su-loading-container">
              <div className="status-spinner" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="settings-all-content" hidden={isSettingsLoading} aria-hidden={isSettingsLoading}>
          <SettingUser
            registerSaveHandler={registerSaveHandler}
            onSettingsChanged={clearSaveSummary}
            onLoadingChange={setIsProfileLoading}
          />
          <SettingAgent
            registerSaveHandler={registerSaveHandler}
            onSettingsChanged={clearSaveSummary}
            onLoadingChange={setIsOpenRouterLoading}
          />

          <div className="settings-save-all-panel">
            <button
              className="setting-agent-primary settings-save-all-button"
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={isSavingAll || !saveHandlers.github || !saveHandlers.openrouter}
            >
              {isSavingAll ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
              {isSavingAll ? 'Saving all…' : 'Save All'}
            </button>
            {saveResults && (
              <div
                className="settings-save-all-results"
                role={hasSaveErrors ? 'alert' : 'status'}
                aria-live={hasSaveErrors ? 'assertive' : 'polite'}
              >
                {allUnchanged ? (
                  <p>No changes to save.</p>
                ) : saveResults.map((result) => (
                  <p key={result.sectionId} className={result.status === 'error' ? 'is-error' : ''}>
                    {result.status === 'error' ? <AlertCircle size={15} aria-hidden="true" /> : <CheckCircle size={15} aria-hidden="true" />}
                    <span><strong>{result.sectionName}:</strong> {result.message}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Pengaturan Visual */}
          <SettingVisual />

          {/* Pengaturan Audio */}
          <SettingAudio />
        </div>

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
