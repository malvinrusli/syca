import Link from "next/link";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">SYCA AI</CardTitle>
          <CardDescription>Personal branding chat for Start Your Content Academy.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={params.next} error={params.error} message={params.message} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Access is invite-only. Contact an admin to get set up.{" "}
            <Link href="/auth/set-password" className="underline underline-offset-4">
              Set password
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
