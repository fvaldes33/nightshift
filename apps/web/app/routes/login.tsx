import { auth } from "@openralph/backend/lib/auth";
import { GithubIcon } from "lucide-react";
import { useState } from "react";
import { redirect } from "react-router";
import { Button } from "@openralph/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openralph/ui/components/card";
import { Input } from "@openralph/ui/components/input";
import { signIn } from "~/lib/auth-client";
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) {
    throw redirect("/");
  }
  return null;
}

export function meta() {
  return [{ title: "Sign in — ralph" }];
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGitHub() {
    setLoading(true);
    setError(null);
    await signIn.social({ provider: "github", callbackURL: "/" });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await signIn.email(
      { email, password, callbackURL: "/" },
    );
    if (authError) {
      setError(authError.message ?? "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center">
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase mb-2">
            openralph
          </p>
          <CardTitle className="text-xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGitHub}
            disabled={loading}
          >
            <GithubIcon className="size-4" />
            Continue with GitHub
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground font-mono">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-destructive-foreground">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
