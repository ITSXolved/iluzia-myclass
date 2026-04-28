'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

const BASE = 'https://www.xraitechnolab.com';
const BUILD_PATH = '/3dexperiential-learning/api/unity/channel-partner-web-build/Build-fixed';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    __UNITY_CFG__?: Record<string, unknown>;
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>,
      onProgress?: (p: number) => void,
    ) => Promise<any>;
  }
}

/**
 * Custom XR Player — loads Unity WebGL directly.
 *
 * Uses the Unity config from the XR AI docs:
 *   Loader → MyBuild.loader.js
 *   Data   → MyBuild.data.gz
 *   Framework → MyBuild.framework.js.gz
 *   WASM   → MyBuild.wasm.gz
 *
 * Calls SendMessage("VeekshaLibraryBehaviourController", "LoadContentFilePath", url)
 */

function PlayerContent() {
  const searchParams = useSearchParams();
  const contentUrl = searchParams.get('content');
  const topicName = searchParams.get('title') || 'XR Content';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const unityRef = useRef<unknown>(null);

  useEffect(() => {
    if (!contentUrl) return;

    // Intercept console.error to filter out harmless Unity warnings
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('FS.syncfs operations in flight at once')) {
        return; // Ignore this specific Unity WebGL warning
      }
      originalConsoleError.apply(console, args);
    };

    // Set Unity config globally before loader runs
    window.__UNITY_CFG__ = {
      rootElId: 'unity-root',
      statusElId: null,
      canvasId: 'unity-canvas',
      loaderUrl: `${BASE}${BUILD_PATH}/MyBuild.loader.js?v=2024`,
      dataUrl: `${BASE}${BUILD_PATH}/MyBuild.data.gz?v=2024`,
      frameworkUrl: `${BASE}${BUILD_PATH}/MyBuild.framework.js.gz?v=2024`,
      wasmUrl: `${BASE}${BUILD_PATH}/MyBuild.wasm.gz?v=2024`,
      goName: 'VeekshaLibraryBehaviourController',
      enableCoi: false,
    };
    return () => {
      console.error = originalConsoleError;
      if (unityRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (unityRef.current as any).Quit();
        } catch (e) {
          console.error('Failed to quit Unity instance:', e);
        }
      }
    };
  }, [contentUrl]);

  const handleLoaderReady = () => {
    if (!contentUrl || !canvasRef.current) return;

    const cfg = window.__UNITY_CFG__ as Record<string, string> | undefined;
    if (!cfg) return;

    // Use createUnityInstance provided by the loader
    const createFn = window.createUnityInstance;
    if (!createFn) {
      setError('Unity loader did not initialize. Please try again.');
      setStatus('error');
      return;
    }

    const config = {
      dataUrl: cfg.dataUrl,
      frameworkUrl: cfg.frameworkUrl,
      codeUrl: cfg.wasmUrl,
      streamingAssetsUrl: 'StreamingAssets',
      companyName: 'XR AI',
      productName: 'XR Experiential Learning',
      productVersion: '1.0',
    };

    createFn(canvasRef.current, config, (p: number) => {
      setProgress(Math.round(p * 100));
    })
      .then((instance: unknown) => {
        unityRef.current = instance;
        setStatus('ready');

        // ── Unlock Web Audio API on first user gesture ──────────────────
        // Browsers suspend AudioContext until a gesture occurs.
        // Unity's AudioContext is stored in Module.AL.currentCtx (Unity 2020+).
        const unlockAudio = () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mod = (instance as any)?.Module;
            const ctx: AudioContext | undefined = mod?.AL?.currentCtx;
            if (ctx && ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }
          } catch {}
          setAudioUnlocked(true);
          document.removeEventListener('pointerdown', unlockAudio);
          document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('pointerdown', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
        // ────────────────────────────────────────────────────────────────

        // Wait a moment then send the content URL
        setTimeout(() => {
          try {
            const inst = instance as { SendMessage: (go: string, method: string, url: string) => void };
            inst.SendMessage(
              'VeekshaLibraryBehaviourController',
              'LoadContentFilePath',
              contentUrl,
            );
          } catch (e) {
            console.error('SendMessage error:', e);
          }
        }, 1500);
      })
      .catch((err: Error) => {
        console.error('Unity init error:', err);
        setError(err.message || 'Failed to load Unity player');
        setStatus('error');
      });
  };

  if (!contentUrl) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a1a', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h1 style={{ color: '#fff', fontSize: '1.3rem' }}>No Content URL Provided</h1>
        <p style={{ color: '#94a3b8' }}>Select a topic from the explore page to view content.</p>
        <button onClick={() => window.history.back()} className="btn btn-primary">← Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0a1a', position: 'relative' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        padding: '12px 20px',
        background: 'linear-gradient(rgba(0,0,0,.9), rgba(0,0,0,.4), transparent)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={() => window.history.back()} className="btn btn-ghost btn-sm"
          style={{ color: '#fff', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,0.5)' }}>
          ← Back
        </button>
        <h3 style={{ color: '#fff', fontSize: '.9rem', fontWeight: 600, opacity: .9 }}>
          {topicName}
        </h3>
      </div>

      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 15,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: '#0a0a1a', gap: 20,
        }}>
          <div style={{ animation: 'float 3s ease-in-out infinite' }}>
            <img src="/iluzia-logo.png" alt="Iluzia Logo" style={{ height: '70px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>Loading 3D Content…</h2>

          {/* Progress bar */}
          <div style={{
            width: 280, height: 6, borderRadius: 3,
            background: 'rgba(255,255,255,.1)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
              transition: 'width 200ms ease',
            }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '.85rem' }}>{progress}% loaded</p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 15,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: '#0a0a1a', gap: 16,
        }}>
          <div style={{ fontSize: '3rem' }}>❌</div>
          <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>Failed to Load</h2>
          <p style={{ color: '#94a3b8', fontSize: '.9rem', maxWidth: 400, textAlign: 'center' }}>
            {error || 'Unity WebGL player could not be initialized.'}
          </p>

          {/* Fallback: open in XR AI player directly */}
          <a
            href={`${BASE}/3dexperiential-learning/player?content=${encodeURIComponent(contentUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            🔗 Open in XR AI Player
          </a>
          <button onClick={() => window.history.back()} className="btn btn-ghost"
            style={{ color: '#94a3b8' }}>
            ← Go Back
          </button>
        </div>
      )}

      {/* Unity container */}
      <div id="unity-root" style={{
        width: '100%', height: '100%',
        display: status === 'ready' ? 'block' : 'none',
      }}>
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          style={{ width: '100%', height: '100%', background: '#0a0a1a' }}
          tabIndex={-1}
        />

        {/* Audio unlock prompt — shown until first interaction */}
        {!audioUnlocked && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 30, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.15)', borderRadius: 50,
            padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: '.8rem', fontWeight: 500,
            animation: 'pulse 2s ease-in-out infinite', pointerEvents: 'none',
          }}>
            🔈 Tap anywhere to enable audio
          </div>
        )}
      </div>

      {/* Load Unity loader script */}
      <Script
        src={`${BASE}${BUILD_PATH}/MyBuild.loader.js?v=2024`}
        strategy="afterInteractive"
        onLoad={handleLoaderReady}
        onError={() => {
          setError('Could not download Unity loader. Check your connection.');
          setStatus('error');
        }}
      />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a1a', flexDirection: 'column', gap: 16,
      }}>
        <div className="spinner spinner-lg" />
        <p style={{ color: '#64748b' }}>Preparing player…</p>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
