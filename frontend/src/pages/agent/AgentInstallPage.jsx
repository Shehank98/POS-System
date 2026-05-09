import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AgentInstallPage() {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;

  useEffect(() => {
    // Swap manifest to agent-specific one
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute('href');
    if (link) link.setAttribute('href', '/agent-manifest.json');

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      if (link && original) link.setAttribute('href', original);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setInstalled(true);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo + brand */}
        <div style={styles.header}>
          <img src="/logo.png" alt="BillFlow" style={styles.logo} />
          <h1 style={styles.brand}>BillFlow Agent</h1>
          <p style={styles.tagline}>Install the agent portal on your phone</p>
        </div>

        {/* Already running as PWA */}
        {isInStandaloneMode && (
          <div style={styles.successBox}>
            <span style={styles.checkIcon}>✓</span>
            <span>App already installed!</span>
          </div>
        )}

        {/* Installed confirmation */}
        {installed && !isInStandaloneMode && (
          <div style={styles.successBox}>
            <span style={styles.checkIcon}>✓</span>
            <span>Installed! Open the BillFlow Agent icon on your home screen.</span>
          </div>
        )}

        {/* Android install button */}
        {installPrompt && !installed && (
          <button style={styles.installBtn} onClick={handleInstall}>
            <span style={styles.installIcon}>⬇</span> Install App
          </button>
        )}

        {/* iOS instructions */}
        {isIOS && !isInStandaloneMode && (
          <div style={styles.iosBox}>
            <p style={styles.iosTitle}>Install on iPhone / iPad</p>
            <ol style={styles.iosList}>
              <li>Tap the <strong>Share</strong> button <span style={styles.shareIcon}>⬆</span> at the bottom of Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>Add</strong> in the top right</li>
            </ol>
          </div>
        )}

        {/* No prompt + not iOS = Chrome hasn't decided yet or already installed */}
        {!installPrompt && !isIOS && !isInStandaloneMode && !installed && (
          <p style={styles.hint}>
            Open this page in Chrome on Android to get the install prompt.
          </p>
        )}

        <hr style={styles.divider} />

        {/* Portal link */}
        <button style={styles.portalBtn} onClick={() => navigate('/agent/login')}>
          Open Agent Portal
        </button>
        <p style={styles.footerNote}>
          Already have an account? Log in directly.
        </p>
      </div>
    </div>
  );
}

const GREEN = '#059669';
const GREEN_LIGHT = '#ecfdf5';
const GREEN_DARK = '#047857';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #064e3b 0%, #059669 60%, #34d399 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '36px 28px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logo: {
    width: '64px',
    height: '64px',
    objectFit: 'contain',
    borderRadius: '16px',
    marginBottom: '12px',
  },
  brand: {
    margin: '0 0 6px',
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.5px',
  },
  tagline: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
  },
  installBtn: {
    width: '100%',
    padding: '14px',
    background: GREEN,
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
    boxShadow: `0 4px 14px rgba(5,150,105,0.35)`,
  },
  installIcon: {
    fontSize: '18px',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: GREEN_LIGHT,
    border: `1px solid #6ee7b7`,
    borderRadius: '10px',
    padding: '12px 16px',
    color: GREEN_DARK,
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: '16px',
  },
  checkIcon: {
    fontSize: '18px',
    fontWeight: '900',
  },
  iosBox: {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid #e2e8f0',
  },
  iosTitle: {
    margin: '0 0 10px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
  },
  iosList: {
    margin: 0,
    paddingLeft: '18px',
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.8',
  },
  shareIcon: {
    display: 'inline-block',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '4px',
    padding: '0 4px',
    fontSize: '12px',
  },
  hint: {
    fontSize: '13px',
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: '16px',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '20px 0',
  },
  portalBtn: {
    width: '100%',
    padding: '13px',
    background: 'transparent',
    color: GREEN,
    border: `2px solid ${GREEN}`,
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  footerNote: {
    margin: 0,
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
  },
};
