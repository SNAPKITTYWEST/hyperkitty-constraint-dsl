import { useEffect, useState } from 'react';
import { AppShell } from './components/shell/AppShell';
import { Welcome } from './pages/Welcome';
import { useWorkspaceStore } from './stores/workspace.store';
import { sovereignIDE } from '../artifacts/SOVEREIGN_IDE_FRAMEWORK';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [sovereignReady, setSovereignReady] = useState(false);
  const { workspaceId, initialize } = useWorkspaceStore();

  useEffect(() => {
    // Initialize Sovereign IDE framework (all BOB components)
    sovereignIDE.initialize().then(() => {
      setSovereignReady(true);
      console.log('✅ Sovereign IDE Framework loaded');
    });

    // Initialize stores and check for existing workspace
    initialize().finally(() => setIsLoading(false));
  }, [initialize]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)'
      }}>
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🤖</div>
          <div>Loading BOB IDE...</div>
        </div>
      </div>
    );
  }

  // Show welcome screen if no workspace is open
  if (!workspaceId) {
    return <Welcome />;
  }

  // Show main IDE shell
  return <AppShell />;
}

export default App;

// Made with Bob
