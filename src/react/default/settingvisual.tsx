// src/react/default/settingvisual.tsx
import React from 'react';
import { Paintbrush, Palette, Sun, Moon, Monitor, Eye, CloudMoon, Trees, Droplets, Battery, SunDim, Sparkles, MoonStar } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@redux/store';
import { setMode, setPalette } from '@redux/themeslice';
import type { ThemeMode, ThemePalette } from '@redux/themeslice';

const SettingVisual: React.FC = () => {
  const dispatch = useDispatch();
  const { mode, palette } = useSelector((state: RootState) => state.theme);

  const themeModes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'auto', label: 'Auto', icon: <Monitor size={16} /> },
    { value: 'light', label: 'Light', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
    { value: 'sepia', label: 'Sepia', icon: <SunDim size={16} /> },
    { value: 'night', label: 'Night', icon: <CloudMoon size={16} /> },
    { value: 'forest', label: 'Forest', icon: <Trees size={16} /> },
    { value: 'ocean', label: 'Ocean', icon: <Droplets size={16} /> },
    { value: 'amoled', label: 'Amoled', icon: <Battery size={16} /> },
    { value: 'dim', label: 'Dim', icon: <Eye size={16} /> },
    { value: 'solarized', label: 'Solarized', icon: <Sparkles size={16} /> },
    { value: 'dracula', label: 'Dracula', icon: <MoonStar size={16} /> },
  ];

  const palettes: ThemePalette[] = [
    'default', 'emerald', 'sapphire', 'amethyst', 'ruby', 'topaz', 'rose',
    'cyan', 'lime', 'indigo', 'coral', 'amber', 'violet', 'teal', 'lavender',
    'peach', 'mint', 'navy', 'salmon', 'plum', 'gold', 'sky', 'forest', 'wine'
  ];

  return (
    <>
      <section className="stack-item">
        <div className="section-header">
          <Paintbrush size={18} />
          <span className="section-label"><span>Theme Mode</span></span>
          <span className="section-value" translate="no">{mode.toUpperCase()}</span>
        </div>
        <div className="genre-list hide-scrollbar" style={{ marginTop: '8px' }}>
          {themeModes.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`genre-chip ${mode === m.value ? 'active' : ''}`}
              onClick={() => dispatch(setMode(m.value))}
            >
              {m.icon}
              <span style={{ marginLeft: 6 }}>{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack-item">
        <div className="section-header">
          <Palette size={18} />
          <span className="section-label"><span>Color Palette</span></span>
          <span className="section-value" translate="no">{palette.toUpperCase()}</span>
        </div>
        <div className="genre-list hide-scrollbar" style={{ marginTop: '8px' }}>
          {palettes.map((p) => (
            <button
              key={p}
              type="button"
              className={`genre-chip ${palette === p ? 'active' : ''}`}
              onClick={() => dispatch(setPalette(p))}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </section>
    </>
  );
};

export default SettingVisual;