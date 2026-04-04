import React from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LoadingSpinner = ({ size = 'md', text, fullScreen = false }) => {
  const { t } = useTranslation();
  
  // Size mapping
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 36,
  };

  // Use explicitly passed text OR fallback to translated default
  const displayText = text !== undefined ? text : t('common.loading');

  const SpinnerContent = (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        {/* Smooth glowing background */}
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 blur-md animate-pulse"></div>
        
        {/* Inner spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-400 animate-spin"></div>
        
        {/* Inner pulsing core */}
        <div className="absolute inset-2 bg-blue-50 rounded-full flex items-center justify-center shadow-inner">
          <Activity className="text-blue-600 animate-pulse" size={iconSizes[size]} strokeWidth={2.5} />
        </div>
      </div>
      
      {displayText && (
        <p className="mt-5 text-slate-500 font-bold text-sm tracking-wide animate-pulse">
          {displayText}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-md z-[9999] flex items-center justify-center">
        {SpinnerContent}
      </div>
    );
  }

  return SpinnerContent;
};

export default LoadingSpinner;












// import React from 'react';
// import { Activity } from 'lucide-react';

// const LoadingSpinner = ({ size = 'md', text = 'Loading...', fullScreen = false }) => {
//   const sizeClasses = {
//     sm: 'w-8 h-8',
//     md: 'w-16 h-16',
//     lg: 'w-24 h-24',
//   };

//   const SpinnerContent = (
//     <div className="flex flex-col items-center justify-center p-8">
//       <div className="relative flex items-center justify-center">
//         {/* Outer spinning ring */}
//         <div className={`absolute rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin ${sizeClasses[size]}`}></div>
        
//         {/* Inner pulsing glow */}
//         <div className={`absolute rounded-full bg-blue-100 animate-ping ${sizeClasses[size]} opacity-20`}></div>
        
//         {/* Center Icon */}
//         <Activity className="text-blue-600 w-1/2 h-1/2 relative z-10 animate-pulse" />
//       </div>
//       {text && <p className="mt-6 text-slate-500 font-medium animate-pulse">{text}</p>}
//     </div>
//   );

//   // If used for full page routing, add a blurred background overlay
//   if (fullScreen) {
//     return (
//       <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-sm z-50 flex items-center justify-center">
//         {SpinnerContent}
//       </div>
//     );
//   }

//   return SpinnerContent;
// };

// export default LoadingSpinner;