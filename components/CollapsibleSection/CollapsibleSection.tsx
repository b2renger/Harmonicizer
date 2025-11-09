import React, { useState } from 'react';
import './CollapsibleSection.css';

const CollapsibleSection = ({ title, children, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

    const toggleOpen = () => {
        setIsOpen(prev => !prev);
    };

    return (
        <div className="collapsible-section">
            <button className="section-header" onClick={toggleOpen} aria-expanded={isOpen}>
                <h3>{title}</h3>
                <svg 
                    className={`chevron-icon ${isOpen ? 'open' : ''}`}
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div className={`section-content ${isOpen ? 'open' : ''}`}>
                <div className="section-content-inner">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;