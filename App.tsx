import React, { useState, useEffect } from 'react';
import './App.css';
import Composer from './modes/composer/Composer.tsx';

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return { width, height };
}

function App() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="container">
      <Composer screenWidth={windowDimensions.width} screenHeight={windowDimensions.height} />
    </div>
  );
}

export default App;
