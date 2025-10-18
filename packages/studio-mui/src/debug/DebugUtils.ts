/**
 * Mobile Debug Console
 */
// TODO - if dev (or perhaps a shortcut key?)
const enableMobileDebug = () => {
  if (typeof window !== 'undefined'
      && window.location.hostname !== 'localhost'
      && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
    // Only enable on real devices, not local dev
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    document.head.appendChild(script);
    script.onload = () => {
      (window as any).eruda.init();
    };
  }
};

export const DebugUtils = {
  enableMobileDebug
}

// Call this in your app initialization
// enableMobileDebug();