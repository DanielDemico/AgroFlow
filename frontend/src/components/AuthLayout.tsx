import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="flex min-h-screen w-full bg-[#0f172a] text-white">
      {/* Left side: Illustration/Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary-900 to-primary-600 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20">
              <span className="text-4xl font-bold">N8</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Master Your Workflows</h1>
          <p className="text-primary-100 text-lg">
            Automate anything, anywhere. The most powerful mini-automation platform for your daily tasks.
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            <p className="text-slate-400">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
