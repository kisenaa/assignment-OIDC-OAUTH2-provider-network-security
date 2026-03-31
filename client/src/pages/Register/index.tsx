import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';

const Register = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#fdf7f1] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Registration
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Registration UI Planned Soon
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Registration will be integrated with your BFF and Keycloak realm flow.
          For now, use login to test the authentication redirection.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" className="px-6" onClick={() => navigate('/login')}>
            Go to Login
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
      </section>
    </main>
  );
};

export default Register;
