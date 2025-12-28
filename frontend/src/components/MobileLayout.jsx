import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';      // Existing file in src/components/
import BottomNav from './BottomNav'; // New file in src/components/
import AiChatbot from './AiChatbot'; // Existing file in src/components/

const MobileLayout = () => {
  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      
      {/* 1. Top Navigation (Fixed Header) */}
      <div className="flex-shrink-0 z-50 bg-white shadow-sm pt-[env(safe-area-inset-top)]">
        {/* <Navbar /> */}
      </div>

      {/* 2. Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-0 pb-24 scroll-smooth">
        {/* This renders the current page (Dashboard, History, etc.) */}
        <Outlet />
      </div>

      {/* 3. Global Overlays & Navigation */}
      {/* <AiChatbot /> */}
      <BottomNav />
      
    </div>
  );
};

export default MobileLayout;