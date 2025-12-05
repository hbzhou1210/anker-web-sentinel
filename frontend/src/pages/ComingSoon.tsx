import React from 'react';
import './ComingSoon.css';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description }) => {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-content">
        <div className="icon">🚧</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        <div className="status-badge">功能开发中</div>
      </div>
    </div>
  );
};
