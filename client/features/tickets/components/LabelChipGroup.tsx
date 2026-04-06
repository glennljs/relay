import type { Label as TicketLabel } from "../../../../shared/types";
import { TicketMetaBadge } from "./TicketMetaBadge";

export function LabelChipGroup({
  labelIds,
  labelMap
}: {
  labelIds: number[];
  labelMap: Record<number, TicketLabel>;
}) {
  if (labelIds.length === 0) {
    return <span className="text-xs text-slate-400">No labels</span>;
  }

  return (
    <>
      {labelIds.map((labelId) => {
        const label = labelMap[labelId];
        return label ? <TicketMetaBadge key={label.id} color={label.color} name={label.name} /> : null;
      })}
    </>
  );
}
