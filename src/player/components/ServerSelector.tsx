import React from 'react';

export interface ServerOption {
  id: string;
  name: string;
  label: string;
  shortName?: string;
  priority?: number;
}

interface ServerSelectorProps {
  servers: ServerOption[];
  activeServerId: string;
  onSelectServer: (serverId: string) => void;
  disabled?: boolean;
}

export const ServerSelector: React.FC<ServerSelectorProps> = ({
  servers,
  activeServerId,
  onSelectServer,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-2 no-scrollbar scroll-smooth">
      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
        Servers:
      </span>
      {servers.map((server, idx) => {
        const isActive = server.id === activeServerId;
        const displayLabel = server.shortName || `Server ${idx + 1}`;

        return (
          <button
            key={server.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectServer(server.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
              isActive
                ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30'
                : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/80 hover:text-white'
            } disabled:opacity-50 disabled:pointer-events-none`}
            title={server.label || server.name}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isActive ? 'bg-white animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ServerSelector;
