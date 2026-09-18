import React from 'react';

interface PlayerErrorProps {
  message?: string;
  onRetry?: () => void;
  onSwitchServer?: () => void;
}

export const PlayerError: React.FC<PlayerErrorProps> = ({
  message = 'Player is taking longer than expected.',
  onRetry,
  onSwitchServer
}) => {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/95 p-6 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400 text-xl">
        ⚠️
      </div>
      <h3 className="text-white font-bold text-sm sm:text-base mb-1">
        Streaming source unavailable
      </h3>
      <p className="text-white/60 text-xs max-w-sm mb-6">
        {message}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition cursor-pointer"
          >
            Retry Stream
          </button>
        )}
        {onSwitchServer && (
          <button
            type="button"
            onClick={onSwitchServer}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-red-600/30"
          >
            Try Another Server
          </button>
        )}
      </div>
    </div>
  );
};

export default PlayerError;
