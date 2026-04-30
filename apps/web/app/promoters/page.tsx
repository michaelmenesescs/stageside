import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Promoter {
  id: string;
  name: string;
  ig_handle: string | null;
  sound_tags: string[] | null;
  fit_score: number | null;
  last_active: string | null;
  notes: string | null;
}

export default async function PromotersPage() {
  const supabase = await createClient();

  const { data: promoters, error } = await supabase
    .from("promoters")
    .select("id, name, ig_handle, sound_tags, fit_score, last_active, notes")
    .order("fit_score", { ascending: false })
    .returns<Promoter[]>();

  if (error) {
    return (
      <div>
        <p className="text-xs text-red-500">Failed to load promoters.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-sm tracking-widest uppercase">Promoters</h1>
        <span className="text-xs text-muted-foreground">
          {promoters?.length ?? 0} total
        </span>
      </div>

      {!promoters || promoters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No promoters yet. Run the seed script to populate.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wider uppercase text-muted-foreground">
              <th className="text-left pb-3 pr-6 font-normal">Name</th>
              <th className="text-left pb-3 pr-6 font-normal">Instagram</th>
              <th className="text-left pb-3 pr-6 font-normal">Sound</th>
              <th className="text-left pb-3 pr-6 font-normal">Fit</th>
              <th className="text-left pb-3 font-normal">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {promoters.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/50 hover:bg-card transition-colors group"
              >
                <td className="py-3 pr-6">
                  <Link
                    href={`/promoters/${p.id}`}
                    className="text-foreground group-hover:text-muted-foreground transition-colors"
                  >
                    {p.name}
                  </Link>
                  {p.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                      {p.notes}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-6 text-muted-foreground">
                  {p.ig_handle ? `@${p.ig_handle}` : "—"}
                </td>
                <td className="py-3 pr-6">
                  {p.sound_tags && p.sound_tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.sound_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pr-6">
                  {p.fit_score != null ? (
                    <span
                      className={
                        p.fit_score >= 80
                          ? "text-foreground"
                          : p.fit_score >= 65
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                      }
                    >
                      {p.fit_score}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 text-muted-foreground">
                  {p.last_active ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
