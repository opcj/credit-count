import { requireViewer } from "@/lib/data";
import { SettingsForm } from "@/components/settings";
export const metadata = { title: "Your settings" };
export default async function SettingsPage() {
  const { profile } = await requireViewer();
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">JUST THE WAY YOU LIKE IT</p>
          <h1>
            A collection that’s <span>yours.</span>
          </h1>
          <p className="page-intro">
            Your name, your privacy, your place in the community.
          </p>
        </div>
      </header>
      <SettingsForm key={profile.user_id} profile={profile} />
    </>
  );
}
