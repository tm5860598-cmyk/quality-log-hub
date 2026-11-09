import { useProfilePrefs } from "@/lib/profile-prefs";

/** Profile photo, or the first letter of the username on a colored circle. */
export function UserAvatar({ name, className = "size-10", textClass = "text-sm" }: { name?: string; className?: string; textClass?: string }) {
  const { avatarUrl } = useProfilePrefs();
  if (avatarUrl) return <img src={avatarUrl} alt={name ? `صورة ${name}` : "صورة المستخدم"} className={`${className} shrink-0 rounded-full border border-white/30 object-cover shadow`} />;
  return (
    <span className={`${className} ${textClass} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 font-extrabold text-white shadow`}>
      {(name || "ط").slice(0, 1).toUpperCase()}
    </span>
  );
}
