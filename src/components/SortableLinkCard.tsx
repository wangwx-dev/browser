import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkCard } from './LinkCard';
import type { LinkItem } from './LinkCard';
import { GripHorizontal } from 'lucide-react';

interface SortableLinkCardProps {
  link: LinkItem;
  id: string; // The unique ID for the sortable item
  isEditing?: boolean;
  onDelete?: () => void;
}

export const SortableLinkCard: React.FC<SortableLinkCardProps> = ({ link, id, isEditing, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: !isEditing // Disable dragging when not in edit mode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditing && (
        <div 
          {...attributes} 
          {...listeners}
          style={{
            position: 'absolute', top: '-10px', left: '10px', width: '30px', height: '30px',
            borderRadius: '50%', background: 'var(--glass-bg)', color: '#94a3b8',
            border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'grab', zIndex: 11,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          title="拖动调整位置"
        >
          <GripHorizontal size={16} />
        </div>
      )}
      <LinkCard 
        link={link} 
        isEditing={isEditing} 
        onDelete={onDelete} 
      />
    </div>
  );
};
