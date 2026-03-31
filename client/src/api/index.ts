import useProviderStore from '@/store/providerStore';
import config from '@/config';

const BASE_URL = config.API_BASE_URL;

const getProviderPath = () => {
  // fallback to keycloak if Zustand is not available (e.g. SSR)
  try {
    const { provider } = useProviderStore.getState();
    return provider === 'ory-hydra' ? 'ory-hydra' : 'keycloak';
  } catch {
    return 'keycloak';
  }
};

const ENDPOINTS = {
  // provider bff auth
  login: () => `${BASE_URL}/auth/${getProviderPath()}/login`,
  callback: () => `${BASE_URL}/auth/${getProviderPath()}/callback`,
  refresh: () => `${BASE_URL}/auth/${getProviderPath()}/refresh`,
  logout: () => `${BASE_URL}/auth/${getProviderPath()}/logout`,
  me: () => `${BASE_URL}/auth/${getProviderPath()}/me`,

  // auth
  getSignData: `${BASE_URL}/user/auth_message`,
  loginUser: `${BASE_URL}/user/sign_in`,
  logoutUser: `${BASE_URL}/user/sign_out`,
};

export const buildKeycloakLoginUrl = (redirectTo?: string) => {
  const url = new URL(ENDPOINTS.login());
  if (redirectTo) {
    url.searchParams.set('redirectTo', redirectTo);
  }
  return url.toString();
};

type KeycloakError = {
  message?: string;
};

export type KeycloakMeResponse = {
  authenticated: boolean;
  verified: boolean;
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as KeycloakError;
    return body.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export const fetchKeycloakMe = async (): Promise<KeycloakMeResponse> => {
  const response = await fetch(ENDPOINTS.me(), {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }
  return response.json() as Promise<KeycloakMeResponse>;
};

export const logoutKeycloakSession = async () => {
  const response = await fetch(ENDPOINTS.logout(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }
};

export default ENDPOINTS;
