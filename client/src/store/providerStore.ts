import { create } from 'zustand';

export type ProviderType = 'keycloak' | 'ory-hydra';

interface ProviderState {
  provider: ProviderType;
  setProvider: (provider: ProviderType) => void;
}

const PROVIDER_KEY = 'oidc_provider';

const getInitialProvider = (): ProviderType => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(PROVIDER_KEY);
    if (stored === 'ory-hydra' || stored === 'keycloak') return stored;
  }
  return 'keycloak';
};

const useProviderStore = create<ProviderState>(set => ({
  provider: getInitialProvider(),
  setProvider: (provider: ProviderType) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROVIDER_KEY, provider);
    }
    set({ provider });
  },
}));

export default useProviderStore;
