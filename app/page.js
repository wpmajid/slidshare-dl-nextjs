import { FRONTEND_ENABLED } from '../lib/public-settings';
import DownloaderApp from './DownloaderApp';

export default function Home() {
  if (!FRONTEND_ENABLED) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#94a3b8',
        }}
      >
        <p>There is nothing here.</p>
      </main>
    );
  }

  return <DownloaderApp />;
}
