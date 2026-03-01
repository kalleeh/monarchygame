import React from 'react';

interface NextStepBannerProps {
  text: string;
  action: string;
  onClick?: () => void;
}

export function NextStepBanner({ text, action, onClick }: NextStepBannerProps) {
  return (
    <div className="next-step-banner">
      <span className="next-step-icon">📌</span>
      <span className="next-step-text">{text}</span>
      <button className="next-step-btn" onClick={onClick}>{action} →</button>
    </div>
  );
}
