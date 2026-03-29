import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button"
import { ENDPOINTS } from "@/services/api-endpoints"
import { apiClient } from '@/services/api-client';

const BUTTONS = [
  { id: 'gitlab', label: 'Continue with GitLab' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'google', label: 'Continue with Google' },
];

export default function Login() {
  const [availableProviders, setAvailableProviders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didFetchRef = useRef(false);

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    apiClient.getAuthConfig()
      .then((res: any) => setAvailableProviders(res.providers || []))
      .catch((err) => {
        console.error('Unable to fetch auth config', err);
        setError('Unable to load authentication providers.');
        setAvailableProviders([]);
      });
  }, []);

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
          ) : (
            <div className="text-sm text-muted-foreground">
              {error || 'No OAuth providers are configured on the server. Please contact an administrator.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
