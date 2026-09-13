import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
export const metadata = { title: "Start your collection" };
export default function SignUp() {
  return (
    <AuthLayout signup>
      <AuthForm mode="sign-up" />
    </AuthLayout>
  );
}
