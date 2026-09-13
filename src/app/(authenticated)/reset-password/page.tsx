import { AuthForm } from "@/components/auth-form";
import { requireViewer } from "@/lib/data";
export default async function ResetPassword() {
  await requireViewer();
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">A FRESH START</p>
          <h1>
            Update your <span>password.</span>
          </h1>
        </div>
      </header>
      <section className="card settings-card">
        <AuthForm mode="reset" />
      </section>
    </>
  );
}
