import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { initialProfileForm, type ProfileForm } from './constants';
import SettingsSidebar from './SettingsSidebar';

import { fetchKeycloakMe, logoutKeycloakSession } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get('tab') ?? '';

  const [form, setForm] = useState<ProfileForm>(initialProfileForm);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const hydrateProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const profile = await fetchKeycloakMe();
        const claims = profile.claims;
        // Hydra puts user info in claims.ext, Keycloak puts it directly in claims

        const ext = ((claims && typeof claims.ext === 'object' && claims.ext) ||
          claims) as Record<string, unknown>;

        const name = typeof ext.name === 'string' ? ext.name : '';
        const nameParts = name.trim().split(/\s+/).filter(Boolean);
        const givenName =
          typeof ext.given_name === 'string' ? ext.given_name : '';
        const familyName =
          typeof ext.family_name === 'string' ? ext.family_name : '';

        setForm(prev => ({
          ...prev,
          firstName: givenName || nameParts[0] || initialProfileForm.firstName,
          lastName:
            familyName ||
            nameParts.slice(1).join(' ') ||
            initialProfileForm.lastName,
          username:
            (typeof ext.preferred_username === 'string'
              ? ext.preferred_username
              : '') || initialProfileForm.username,
          email:
            (typeof ext.email === 'string' ? ext.email : '') ||
            initialProfileForm.email,
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch profile';
        setProfileError(message);
        toast.error('Failed to load account session', {
          id: 'keycloak-me-error',
          duration: Infinity,
          description: <span style={{ color: '#1e293b' }}>{message}</span>,
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    void hydrateProfile();
  }, []);

  const updateField = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleReset = () => {
    setForm(initialProfileForm);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutKeycloakSession();
    } catch {
      // Always move user to landing page after logout attempt.
    } finally {
      navigate('/');
    }
  };

  return (
    <main className="min-h-screen bg-[#fdf7f1]">
      <header className="border-b border-slate-200/80 bg-[#fdf7f1]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Account Settings
            </h1>
            <p className="text-sm text-slate-500">
              Manage profile and identity provider preferences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr]">
        <SettingsSidebar activeTab={activeTab} />

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm sm:p-7"
        >
          <div className="mb-7 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-amber-100">
              JP
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Profile Settings
              </h2>
              <p className="text-sm text-slate-500">
                {isLoadingProfile
                  ? 'Loading account from /auth/keycloak/me...'
                  : 'Update your public and account details.'}
              </p>
            </div>
          </div>

          {profileError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-start gap-3 rounded-2xl border p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-base font-semibold">Authentication issue</p>
                <p className="text-sm leading-relaxed">{profileError}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-slate-700"
              >
                First name
              </label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={event => updateField('firstName', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-slate-700"
              >
                Last name
              </label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={event => updateField('lastName', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-slate-700"
              >
                Username
              </label>
              <Input
                id="username"
                value={form.username}
                onChange={event => updateField('username', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={event => updateField('email', event.target.value)}
              />
            </div>
          </div>

          <div className="my-7 space-y-4 rounded-2xl bg-slate-50 p-4">
            {/* <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <Checkbox
                checked={form.emailUpdates}
                onCheckedChange={checked =>
                  updateField('emailUpdates', Boolean(checked))
                }
              />
              Receive product and release updates by email
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <Checkbox
                checked={form.securityAlerts}
                onCheckedChange={checked =>
                  updateField('securityAlerts', Boolean(checked))
                }
              />
              Receive security sign-in alerts
            </label> */}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" className="cursor-pointer px-6">
              Save profile settings
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-6"
              onClick={handleReset}
            >
              Reset all fields
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default Settings;
