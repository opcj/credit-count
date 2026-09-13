import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";

export const metadata = { title: "Create an account" };
export default function SignUp() {
  return (
    <AuthLayout mode="sign-up">
      <AuthForm mode="sign-up" />
    </AuthLayout>
  );
}
