import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { localAdmin, localDatabase } from "./local-context";

type Credentials = {
  role: string;
  name: string;
  email: string;
  password: string;
  userId: string;
};
const file = "credentials.local.json";
const previous: Credentials[] = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : [];
const fixtures = [
  {
    role: "enthusiast",
    name: "Ari Morgan",
    email: "enthusiast@credit-count.test",
    credits: 15,
    repeats: 7,
    public: false,
  },
  {
    role: "admin",
    name: "Casey Lane",
    email: "admin@credit-count.test",
    credits: 4,
    repeats: 2,
    public: false,
  },
  {
    role: "community",
    name: "Mina Reed",
    email: "mina@credit-count.test",
    credits: 36,
    repeats: 13,
    public: true,
  },
  {
    role: "community",
    name: "Theo Park",
    email: "theo@credit-count.test",
    credits: 29,
    repeats: 8,
    public: true,
  },
  {
    role: "community",
    name: "Jules Rivera",
    email: "jules@credit-count.test",
    credits: 24,
    repeats: 6,
    public: true,
  },
  {
    role: "community",
    name: "Robin Chen",
    email: "robin@credit-count.test",
    credits: 18,
    repeats: 4,
    public: true,
  },
  {
    role: "community",
    name: "Sam Ellis",
    email: "sam@credit-count.test",
    credits: 12,
    repeats: 3,
    public: true,
  },
];
const manifest = JSON.parse(
  readFileSync("supabase/catalogue.json", "utf8"),
) as { id: string }[];
const admin = localAdmin();
const db = await localDatabase();
const accounts: Credentials[] = [];
const stableId = (value: string) => {
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
try {
  await db.query(readFileSync("supabase/seed.sql", "utf8"));
  for (const fixture of fixtures) {
    const existing = await db.query<{ id: string }>(
      "select id from auth.users where email = $1",
      [fixture.email],
    );
    let userId = existing.rows[0]?.id;
    let password = previous.find(
      (c) => c.email === fixture.email && c.userId === userId,
    )?.password;
    if (userId && !password)
      throw new Error(
        `The local demo account ${fixture.email} already exists without its matching local credential file. Refusing to reset its password.`,
      );
    if (!userId) {
      password = randomBytes(18).toString("base64url");
      const { data, error } = await admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: fixture.name },
      });
      if (error) throw error;
      userId = data.user.id;
      await db.query(
        "update public.profiles set leaderboard_opt_in=$1 where user_id=$2",
        [fixture.public, userId],
      );
    }
    if (fixture.role === "admin")
      await db.query(
        "insert into public.admin_users(user_id) values($1) on conflict do nothing",
        [userId],
      );
    for (let i = 0; i < fixture.credits + fixture.repeats; i++) {
      const coasterId = manifest[i < fixture.credits ? i : 0].id;
      const day = new Date(Date.UTC(2026, 7, 1 + i));
      const note =
        i === 0
          ? "Front row. Worth every second of the wait."
          : i === fixture.credits
            ? "Had to go back for another lap."
            : null;
      await db.query(
        "insert into public.rides(id,user_id,coaster_id,ridden_on,note) values($1,$2,$3,$4,$5) on conflict do nothing",
        [
          stableId(`${userId}:demo:${i}`),
          userId,
          coasterId,
          day.toISOString().slice(0, 10),
          note,
        ],
      );
    }
    accounts.push({
      role: fixture.role,
      name: fixture.name,
      email: fixture.email,
      password: password!,
      userId,
    });
    // Persist after each account so an interrupted seed never loses generated credentials.
    writeFileSync(
      file,
      JSON.stringify(
        [
          ...accounts,
          ...previous.filter((c) => !accounts.some((a) => a.email === c.email)),
        ],
        null,
        2,
      ) + "\n",
    );
  }
  console.log(
    "Prepared synthetic demo accounts and rides. Credentials are in ignored credentials.local.json; none were printed.",
  );
} finally {
  await db.end();
}
