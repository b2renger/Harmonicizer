import React from 'react';
import './ProgressionTabs.css';

interface ProgressionTabsProps {
    progressionIds: string[];
    activeId: string;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
    onDuplicate: () => void;
}

const ProgressionTabs: React.FC<ProgressionTabsProps> = ({ progressionIds, activeId, onSelect, onAdd, onDelete, onDuplicate }) => {
    return (
        <div className="progression-tabs">
            {progressionIds.map(id => (
                <div key={id} className={`progression-tab ${id === activeId ? 'active' : ''}`}>
                    <button className="tab-name" onClick={() => onSelect(id)}>
                        Part {id}
                    </button>
                    {progressionIds.length > 1 && (
                        <button 
                            className="tab-delete" 
                            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                            aria-label={`Delete Part ${id}`}
                        >
                            &times;
                        </button>
                    )}
                </div>
            ))}
            <button className="add-progression-tab copy-part-button" onClick={onDuplicate} title="Duplicate the current part">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                <span>Copy Part</span>
            </button>
            <button className="add-progression-tab" onClick={onAdd} title="Add a new song part">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>Add Part</span>
            </button>
        </div>
    );
};

export default React.memo(ProgressionTabs);