import React from 'react';
import { Activity } from 'lucide-react';

const LoadingSpinner = ({ size = 'md', text = 'Loading...', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const SpinnerContent = (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <div className={`absolute rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin ${sizeClasses[size]}`}></div>
        
        {/* Inner pulsing glow */}
        <div className={`absolute rounded-full bg-blue-100 animate-ping ${sizeClasses[size]} opacity-20`}></div>
        
        {/* Center Icon */}
        <Activity className="text-blue-600 w-1/2 h-1/2 relative z-10 animate-pulse" />
      </div>
      {text && <p className="mt-6 text-slate-500 font-medium animate-pulse">{text}</p>}
    </div>
  );

  // If used for full page routing, add a blurred background overlay
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {SpinnerContent}
      </div>
    );
  }

  return SpinnerContent;
};

export default LoadingSpinner;