import React from 'react';
import './LinkCard.css';

export interface LinkItem {
  name: string;
  url: string;
  desc: string;
  icon: string;
}

interface LinkCardProps {
  link: LinkItem;
}

export const LinkCard: React.FC<LinkCardProps> = ({ link }) => {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-card">
      <div className="link-card-content">
        <div className="link-card-icon">
          <img src={link.icon} alt={`${link.name} icon`} onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(link.name) + '&background=random';
          }} />
        </div>
        <div className="link-card-info">
          <h3>{link.name}</h3>
          <p>{link.desc}</p>
        </div>
      </div>
      <div className="link-card-glow"></div>
    </a>
  );
};
