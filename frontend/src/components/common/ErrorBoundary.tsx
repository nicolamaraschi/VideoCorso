import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Check if error is due to a stale chunk / new deployment
    const isChunkError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      const refreshed = sessionStorage.getItem('chunk_reload_attempted');
      if (!refreshed) {
        sessionStorage.setItem('chunk_reload_attempted', 'true');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk_reload_attempted');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 max-w-md w-full shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Nuova versione disponibile</h2>
            <p className="text-sm text-gray-600 mb-6">
              La piattaforma è stata appena aggiornata. Ricarica la pagina per caricare l'ultima versione.
            </p>
            <Button variant="primary" onClick={this.handleReload} className="w-full">
              Aggiorna la pagina
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
