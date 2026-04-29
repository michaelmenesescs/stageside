import { createClient } from "@supabase/supabase-js";
import seedData from "./seed.json";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedVenues() {
  const { error } = await supabase.from("venues").upsert(
    seedData.venues.map((v) => ({ ...v })),
    { onConflict: "name" }
  );
  if (error) throw new Error(`venues upsert failed: ${error.message}`);
  console.log(`Upserted ${seedData.venues.length} venues`);
}

async function seedPromoters() {
  const { error } = await supabase.from("promoters").upsert(
    seedData.promoters.map((p) => ({ ...p })),
    { onConflict: "name" }
  );
  if (error) throw new Error(`promoters upsert failed: ${error.message}`);
  console.log(`Upserted ${seedData.promoters.length} promoters`);
}

async function main() {
  console.log("Seeding Supabase...");
  await seedVenues();
  await seedPromoters();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
