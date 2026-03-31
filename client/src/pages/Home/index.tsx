import { useNavigate } from 'react-router';

import { movingIcons } from './constants';
import TechMarquee from './TechMarquee';

import { Button } from '@/components/ui/button';

const Home = () => {
  const navigate = useNavigate();

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#fdf7f1]">
      {/* Top bar */}
      <header className="border-b border-slate-200/70 bg-[#fdf7f1]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-amber-100">
              ID
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-slate-900">
                OIDC Demo
              </span>
              <span className="text-xs text-slate-500">
                Provider Playground
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="px-4 text-sm transition-transform duration-200 hover:-translate-y-px"
              onClick={() => navigate('/settings')}
            >
              Settings
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-sm text-slate-700 transition-transform duration-200 hover:-translate-y-px"
              onClick={() => navigate('/login')}
            >
              Log in
            </Button>
            <Button
              size="sm"
              className="px-4 text-sm transition-transform duration-200 hover:-translate-y-px"
              onClick={() => navigate('/register')}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero section (main content) */}
      <section className="flex flex-1 items-center">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <div className="max-w-3xl space-y-6 text-left md:space-y-7">
            <p className="text-xs font-semibold tracking-[0.26em] text-slate-500 uppercase sm:text-sm">
              OIDC Provider Assignment
            </p>

            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.2rem]">
              Minimal, secure authentication
              <span className="block text-slate-500">
                to understand real OIDC flows.
              </span>
            </h1>

            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              This demo acts as OpenID Connect provider to see how the login, consent, callback, APIs and
              token flows work.
            </p>

            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              This authentication and authorization server is built using{' '}
              <span className="text-primary font-semibold">Keycloak</span>,{' '}
              <span className="text-primary font-semibold">Ory Hydra</span>, and{' '}
              <span className="text-primary font-semibold">
                389 Directory Server (LDAP)
              </span>
              . The web client is built with{' '}
              <span className="text-primary font-semibold">React</span>, and the
              backend server is built with{' '}
              <span className="text-primary font-semibold">
                Hono.js (Node.js)
              </span>
              . All part of the integration are secured with
              <span className="text-primary font-semibold"> SSL/TLS </span> and
              <span className="text-primary font-semibold"> HTTPS & LDAPS </span>{' '}
              protocol. Each part of the system is containerized using{' '}
              <span className="text-primary font-semibold">Docker</span>.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="px-6 text-sm transition-transform duration-200 hover:-translate-y-px sm:text-base"
                onClick={() => navigate('/login')}
              >
                Log in to demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-6 text-sm transition-transform duration-200 hover:-translate-y-px sm:text-base"
                onClick={() => navigate('/register')}
              >
                Register an account
              </Button>
            </div>
          </div>

          <TechMarquee icons={movingIcons} />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-5 text-center text-xs font-semibold text-slate-500 sm:text-sm">
        Johannes Daniswara Pratama - 5025221276
      </footer>
    </main>
  );
};

export default Home;
