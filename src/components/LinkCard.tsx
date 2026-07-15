import React from 'react';
import { Trash2 } from 'lucide-react';
import './LinkCard.css';

export interface LinkItem {
  name: string;
  url: string;
  desc: string;
  icon: string;
}

interface LinkCardProps {
  link: LinkItem;
  isEditing?: boolean;
  onDelete?: () => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({ link, isEditing, onDelete }) => {
  return (
    <div style={{ position: 'relative' }}>
      <a href={isEditing ? undefined : link.url} target="_blank" rel="noopener noreferrer" className={`link-card ${isEditing ? 'editing' : ''}`} onClick={(e) => isEditing && e.preventDefault()}>
        <div className="link-card-content">
          <div className="link-card-icon">
            <img src={link.icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(link.name)}&background=random`} alt={`${link.name} icon`} onError={(e) => {
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
      
      {isEditing && (
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }}
          style={{
            position: 'absolute', top: '-10px', right: '-10px', width: '30px', height: '30px',
            borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)', zIndex: 10
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};
