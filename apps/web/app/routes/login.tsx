import { Button } from "@openralph/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openralph/ui/components/card";
import { Input } from "@openralph/ui/components/input";
import { GithubIcon } from "lucide-react";
import { useState } from "react";
import { redirect } from "react-router";
import { getSession, signIn } from "~/lib/auth-client";

export async function clientLoader() {
  const session = await getSession();
  if (session?.data?.user) throw redirect("/");
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
    const { error: authError } = await signIn.email({ email, password, callbackURL: "/" });
    if (authError) {
      setError(authError.message ?? "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="border-border/50 w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="text-muted-foreground mb-2 font-mono text-xs uppercase tracking-widest">
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
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground font-mono text-xs">or</span>
            <div className="bg-border h-px flex-1" />
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
            {error && <p className="text-destructive-foreground text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
