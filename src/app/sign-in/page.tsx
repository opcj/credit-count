import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { safeNext } from "@/lib/domain";
export const metadata = { title: "Sign in" };
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthLayout>
      <AuthForm
        mode="sign-in"
        next={safeNext(params.next ?? null)}
        initialError={!!params.error}
      />
    </AuthLayout>
  );
}
