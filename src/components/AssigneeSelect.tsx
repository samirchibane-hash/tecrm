import { cn } from "@/lib/utils";
import { useTeamMembers } from "@/hooks/useTeamMembers";

// Native dropdown for assigning a Creative Request or Task to a team member.
// Value is the member's name. Preserves any pre-existing value that is no
// longer in the roster (e.g. legacy free-text assignments) so it isn't lost.
export function AssigneeSelect({
  value,
  onChange,
  className,
  placeholder = "Unassigned",
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const { members } = useTeamMembers();
  const names = members.map((m) => m.name);
  const hasOrphan = value && !names.includes(value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "text-sm h-9 px-2 rounded-md border border-border bg-background text-foreground",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {members.map((m) => (
        <option key={m.id} value={m.name}>
          {m.position ? `${m.name} — ${m.position}` : m.name}
        </option>
      ))}
      {hasOrphan && <option value={value}>{value}</option>}
    </select>
  );
}
