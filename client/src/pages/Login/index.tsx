import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import useProviderStore, { ProviderType } from '@/store/providerStore';
import { buildKeycloakLoginUrl } from '@/api';

const Login = () => {
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { provider, setProvider } = useProviderStore();

  const handleLogin = () => {
    setIsRedirecting(true);
    let loginUrl = '';
    if (provider === 'keycloak') {
      loginUrl = buildKeycloakLoginUrl('/settings');
    } else {
      // Ory Hydra endpoint
      loginUrl = buildKeycloakLoginUrl('/settings').replace(
        'keycloak',
        'ory-hydra'
      );
    }
    window.location.assign(loginUrl);
  };

  return (
    <main className="min-h-screen bg-[#fdf7f1] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Sign In
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Continue with Provider
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          This app uses BFF architecture. You will be redirected to the backend
          endpoint, then the backend handles the Authorization Code Flow
          securely.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="text-sm font-medium text-slate-700">
            Identity Provider
            <select
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderType)}
              disabled={isRedirecting}
            >
              <option value="keycloak">Keycloak</option>
              <option value="ory-hydra">Ory Hydra</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="px-6"
              disabled={isRedirecting}
              onClick={handleLogin}
            >
              {isRedirecting
                ? `Redirecting to ${provider === 'keycloak' ? 'Keycloak' : 'Ory Hydra'}...`
                : `Login with ${provider === 'keycloak' ? 'Keycloak' : 'Ory Hydra'}`}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-6"
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
