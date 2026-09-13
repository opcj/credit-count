import { getCatalogue, getHistory, requireViewer } from "@/lib/data";
import { RideHistory } from "@/components/ride-history";
export const metadata = { title: "Ride history" };
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireViewer();
  const params = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const [history, coasters] = await Promise.all([
    getHistory(page),
    getCatalogue(true),
  ]);
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">THE MOMENTS THAT MAKE IT</p>
          <h1>
            Every ride has <span>a story.</span>
          </h1>
          <p className="page-intro">
            A journal of the rush, the re-rides, and everything in between.
          </p>
        </div>
        <span className="status-pill">Only you can see this</span>
      </header>
      <RideHistory {...history} page={page} coasters={coasters} />
    </>
  );
}
