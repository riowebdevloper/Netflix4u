import React from 'react';

interface PlayerLoadingProps {
  serverName?: string;
  substatus?: string;
}

export const PlayerLoading: React.FC<PlayerLoadingProps> = ({
  serverName = 'Connecting verified stream...',
  substatus = 'Synchronizing multi-server streaming engine'
}) => {
  return (
    <div
      role="status"
      aria-label="Loading video player"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-300 pointer-events-none"
    >
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-red-600/20 border-t-red-600 animate-spin" />
        <div className="absolute w-6 h-6 rounded-full bg-red-600/10 animate-ping" />
      </div>
      <p className="text-white text-xs sm:text-sm font-semibold tracking-wide text-center px-4">
        {serverName}
      </p>
      {substatus && (
        <p className="text-white/50 text-[11px] mt-1 text-center px-4">
          {substatus}
        </p>
      )}
    </div>
  );
};

export default PlayerLoading;
