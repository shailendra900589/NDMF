import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedStreamUrl, getRecordingStreamUrl } from '../utils/recordingUrl';

export default function RecordingPlayer({ url, compact = false }) {
  const audioRef = useRef(null);
  const [src, setSrc] = useState('');
  const [status, setStatus] = useState('idle');
  const [useAuthStream, setUseAuthStream] = useState(false);
  const streamPath = getRecordingStreamUrl(url);

  useEffect(() => {
    if (!streamPath) {
      setStatus('error');
      return;
    }
    setUseAuthStream(false);
    setSrc(streamPath);
    setStatus('loading');
  }, [streamPath]);

  const handleReady = () => setStatus('ready');

  const handleError = () => {
    if (!useAuthStream) {
      const authUrl = getAuthenticatedStreamUrl(url);
      if (authUrl && authUrl !== src) {
        setUseAuthStream(true);
        setSrc(authUrl);
        setStatus('loading');
        audioRef.current?.load();
        return;
      }
    }
    setStatus('error');
  };

  if (!streamPath) return <span style={{ color: '#9ca3af', fontSize: 12 }}>No recording</span>;
  if (status === 'error') return <span style={{ color: '#ef4444', fontSize: 12 }}>Cannot stream recording</span>;

  return (
    <div className={`recording-player${compact ? ' recording-player--compact' : ''}`}>
      {status === 'loading' && <span className="recording-player__hint">Connecting stream...</span>}
      <audio
        ref={audioRef}
        key={src}
        controls
        preload="metadata"
        controlsList="nodownload"
        className="recording-player__audio"
        src={src}
        onLoadedMetadata={handleReady}
        onCanPlay={handleReady}
        onError={handleError}
      />
      {status === 'ready' && !compact && (
        <span className="recording-player__hint">Streaming online — click play to listen</span>
      )}
    </div>
  );
}
