import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import './styles/app-shell.css';
import "./styles/nutrition.css";
import "./styles/posture.css";
import "./styles/workouts.css";
import "./styles/plan.css";
import "./styles/health-coach.css";
import "./styles/exercise.css";
import "./styles/voice-tab.css";


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
