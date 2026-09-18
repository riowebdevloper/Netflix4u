import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlayerFrame } from './PlayerFrame';
import { ServerSelector, ServerOption } from './ServerSelector';
import { PlayerLoading } from './PlayerLoading';
import { PlayerError } from './PlayerError';

export interface MultiServerPlayerProps {
  canonicalId: string;
  contentType: 'movie' | 'tv';
  tmdbId?: number | string;
  imdbId?: string;
  title: string;
  year?: string | number;
  season?: number;
  episode?: number;
  totalEpisodesInSeason?: number;
  onNavigateEpisode?: (newEpisode: number) => void;
  onClose?: () => void;
}

const STORAGE_KEY = 'preferredProviderId';

export const MultiServerPlayer: React.FC<MultiServerPlayerProps> = ({
  canonicalId,
  contentType,
  tmdbId,
  imdbId,
  title,
  year,
  season = 1,
  episode = 1,
  totalEpisodesInSeason = 1,
  onNavigateEpisode,
  onClose
}) => {
  // Server Resolver (Dynamic require/import for universal compatibility)
  const [providerManager, setProviderManager] = useState<any>(null);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('vidsrc_sbs');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const pm = require('../providers/provider-manager').providerManager;
      setProviderManager(pm);
      const serverList = pm.getServerSelectorList(contentType);
      setServers(serverList);

      const savedPreferred = localStorage.getItem(STORAGE_KEY);
      if (savedPreferred && serverList.some((s: any) => s.id === savedPreferred)) {
        setActiveServerId(savedPreferred);
      } else if (serverList.length > 0) {
        setActiveServerId(serverList[0].id);
      }
    } catch (e) {
      console.error('[MultiServerPlayer] Failed to load provider manager:', e);
    }
  }, [contentType]);

  // Construct current embed URL cleanly from canonical identity
  const currentEmbedUrl = useMemo(() => {
    if (!providerManager) return null;
    const input = {
      canonicalId,
      contentType,
      tmdbId,
      imdbId,
      season,
      episode
    };
    return providerManager.resolvePlayerUrl(input, activeServerId);
  }, [providerManager, canonicalId, contentType, tmdbId, imdbId, season, episode, activeServerId]);

  const handleSelectServer = useCallback((serverId: string) => {
    setActiveServerId(serverId);
    setIsLoading(true);
    setErrorMsg(null);
    try {
      localStorage.setItem(STORAGE_KEY, serverId);
    } catch (e) {}
  }, []);

  const handleTimeout = useCallback(() => {
    // Offer failover or auto switch to next healthy server
    if (!providerManager || servers.length <= 1) {
      setErrorMsg('Player is taking longer than expected.');
      return;
    }
    const curIdx = servers.findIndex(s => s.id === activeServerId);
    const nextServer = servers[(curIdx + 1) % servers.length];
    if (nextServer && nextServer.id !== activeServerId) {
      console.warn(`[MultiServerPlayer] Server ${activeServerId} timed out. Switching to ${nextServer.id}`);
      handleSelectServer(nextServer.id);
    } else {
      setErrorMsg('Player is taking longer than expected.');
    }
  }, [providerManager, servers, activeServerId, handleSelectServer]);

  const handleFrameLoad = useCallback(() => {
    setIsLoading(false);
    setErrorMsg(null);
  }, []);

  const handleFrameError = useCallback(() => {
    setIsLoading(false);
    setErrorMsg('Streaming source unavailable. Try another server.');
  }, []);

  const isTv = contentType === 'tv';
  const displayTitle = `${title}${isTv ? ` • S${season} E${episode}` : ''}`;

  return (
    <div className="w-full flex flex-col bg-black text-white rounded-xl overflow-hidden shadow-2xl border border-white/10">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0f0f17] border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="px-2 py-0.5 rounded bg-red-600 font-black text-[10px] uppercase tracking-wider">
            {isTv ? 'SERIES' : 'MOVIE'}
          </span>
          <span className="font-bold truncate text-white/90">{displayTitle}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Responsive 16:9 Video Frame Container */}
      <div className="relative w-full aspect-video bg-black overflow-hidden">
        {isLoading && <PlayerLoading serverName={servers.find(s => s.id === activeServerId)?.name} />}

        {errorMsg && (
          <PlayerError
            message={errorMsg}
            onRetry={() => {
              setIsLoading(true);
              setErrorMsg(null);
            }}
            onSwitchServer={() => handleTimeout()}
          />
        )}

        {currentEmbedUrl ? (
          <PlayerFrame
            embedUrl={currentEmbedUrl}
            title={displayTitle}
            providerId={activeServerId}
            canonicalId={canonicalId}
            season={season}
            episode={episode}
            onLoad={handleFrameLoad}
            onError={handleFrameError}
            onTimeout={handleTimeout}
          />
        ) : (
          !isLoading && (
            <PlayerError
              message="No verified provider URL could be resolved for this title."
              onSwitchServer={() => handleTimeout()}
            />
          )
        )}
      </div>

      {/* Bottom Bar: TV Episode Navigation + Server Selector */}
      <div className="p-2 sm:p-3 bg-[#0a0a0f] border-t border-white/10 flex flex-col gap-2">
        {isTv && onNavigateEpisode && (
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              disabled={episode <= 1}
              onClick={() => onNavigateEpisode(episode - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition cursor-pointer"
            >
              ⏮️ Prev Episode
            </button>
            <span className="text-xs font-black text-white/80 px-2 py-0.5 rounded bg-white/5 border border-white/10">
              Season {season} • Episode {episode}
            </span>
            <button
              type="button"
              disabled={totalEpisodesInSeason > 0 && episode >= totalEpisodesInSeason}
              onClick={() => onNavigateEpisode(episode + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition cursor-pointer"
            >
              Next Episode ⏭️
            </button>
          </div>
        )}

        {/* Server Selector */}
        <ServerSelector
          servers={servers}
          activeServerId={activeServerId}
          onSelectServer={handleSelectServer}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default MultiServerPlayer;
