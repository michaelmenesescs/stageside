import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-lg font-semibold tracking-widest uppercase mb-2">
            Stageside
          </h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase">
            DJ career operating system
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
