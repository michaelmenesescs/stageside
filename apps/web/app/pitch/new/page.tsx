import { createClient } from "@/lib/supabase/server";
import { PitchForm } from "./pitch-form";

export default async function NewPitchPage({
  searchParams,
}: {
  searchParams: { promoter?: string };
}) {
  const supabase = await createClient();

  const [promotersRes, mixesRes] = await Promise.all([
    supabase
      .from("promoters")
      .select("id, name, ig_handle, fit_score")
      .order("fit_score", { ascending: false })
      .limit(200),

    supabase
      .from("mixes")
      .select("id, title, soundcloud_url, vibe_tags")
      .order("release_date", { ascending: false })
      .limit(20),
  ]);

  const promoters = promotersRes.data ?? [];
  const mixes = mixesRes.data ?? [];
  const preselectedPromoter = searchParams.promoter ?? null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-sm tracking-widest uppercase mb-1">New Pitch</h1>
        <p className="text-xs text-muted-foreground">
          Draft is AI-generated. You review, edit, and send manually.
        </p>
      </div>
      <PitchForm
        promoters={promoters}
        mixes={mixes}
        preselectedPromoter={preselectedPromoter}
      />
    </div>
  );
}
