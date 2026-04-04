import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button"
import { ENDPOINTS } from "@/services/api-endpoints"
import { apiClient } from '@/services/api-client';
import { useNavigate } from 'react-router-dom';

const BUTTONS = [
  { id: 'gitlab', label: 'Continue with GitLab' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'google', label: 'Continue with Google' },
];

export default function Login() {
  const [availableProviders, setAvailableProviders] = useState<string[] | null>(null);
  const [localAuthEnabled, setLocalAuthEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const didFetchRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    apiClient.getAuthConfig()
      .then((res: any) => {
        setAvailableProviders(res.providers || []);
        setLocalAuthEnabled(res.localAuthEnabled ?? false);
      })
      .catch((err) => {
        console.error('Unable to fetch auth config', err);
        setError('Unable to load authentication providers.');
        setAvailableProviders([]);
      });
  }, []);

  const handleLocalLogin = async () => {
    setLoggingIn(true);
    try {
      const res = await fetch('/apis/auth/login/local', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('authToken', data.token);
      navigate('/app/projects');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  if (availableProviders === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center text-sm text-muted-foreground">Loading authentication options...</div>
      </div>
    );
  }

  const available = BUTTONS.filter((btn) => (availableProviders || []).includes(btn.id));

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Playwright Studio</h1>
        <p className="text-muted-foreground w-80">
          The central control plane for your automated browser testing and interaction flows.
        </p>

        <div className="grid gap-2">
          {available.length > 0 ? (
            available.map((btn) => (
              <Button
                key={btn.id}
                size="lg"
                className="w-full"
                onClick={() => window.location.href = ENDPOINTS.AUTH_LOGIN(btn.id)}
              >
                {btn.label}
              </Button>
            ))
          ) : localAuthEnabled ? (
            <>
              <Button
                size="lg"
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold"
                onClick={handleLocalLogin}
                disabled={loggingIn}
              >
                {loggingIn ? 'Signing in…' : 'Login as SuperAdmin'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Local access only. Configure an OAuth provider to enable team login.
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              {error || 'No authentication providers are configured. Please contact an administrator.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
