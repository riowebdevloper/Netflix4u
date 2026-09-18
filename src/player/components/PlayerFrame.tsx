import React, { useRef, useEffect } from 'react';

interface PlayerFrameProps {
  embedUrl: string;
  title: string;
  providerId: string;
  canonicalId: string;
  season?: number;
  episode?: number;
  onLoad?: () => void;
  onError?: (err?: any) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
}

export const PlayerFrame: React.FC<PlayerFrameProps> = ({
  embedUrl,
  title,
  providerId,
  canonicalId,
  season = 1,
  episode = 1,
  onLoad,
  onError,
  onTimeout,
  timeoutMs = 8000
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountKey = `${providerId}:${canonicalId}:${season}:${episode}`;

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    if (timeoutMs > 0 && onTimeout) {
      timer = setTimeout(() => {
        if (isMounted) {
          onTimeout();
        }
      }, timeoutMs);
    }

    const frame = iframeRef.current;
    if (!frame) return;

    const handleLoad = () => {
      if (timer) clearTimeout(timer);
      if (isMounted && onLoad) onLoad();
    };

    const handleError = (e: any) => {
      if (timer) clearTimeout(timer);
      if (isMounted && onError) onError(e);
    };

    frame.addEventListener('load', handleLoad);
    frame.addEventListener('error', handleError);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      frame.removeEventListener('load', handleLoad);
      frame.removeEventListener('error', handleError);
    };
  }, [embedUrl, mountKey, timeoutMs, onLoad, onError, onTimeout]);

  // Security guard: Ensure URL is non-empty and starts with approved protocol
  if (!embedUrl || !/^https?:\/\//i.test(embedUrl)) {
    return null;
  }

  return (
    <iframe
      key={mountKey}
      ref={iframeRef}
      src={embedUrl}
      title={`Netflix4U Player - ${title}`}
      className="w-full h-full border-0 absolute inset-0 bg-black"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="eager"
      referrerPolicy="no-referrer"
    />
  );
};

export default PlayerFrame;
