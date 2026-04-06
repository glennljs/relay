import type { FormEvent } from "react";
import type { Label as TicketLabel, LabelInput } from "../../../../shared/types";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export function LabelManagerDialog({
  open,
  labels,
  labelForm,
  editingLabelId,
  onOpenChange,
  onLabelFormChange,
  onStartEdit,
  onDelete,
  onSubmit
}: {
  open: boolean;
  labels: TicketLabel[];
  labelForm: LabelInput;
  editingLabelId: number | null;
  onOpenChange: (open: boolean) => void;
  onLabelFormChange: (label: LabelInput) => void;
  onStartEdit: (label: TicketLabel) => void;
  onDelete: (id: number) => Promise<void>;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
          <DialogDescription>
            Create and edit label names used for internal ticket grouping.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_auto]" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="label-name">Name</Label>
            <Input
              aria-label="Label name"
              id="label-name"
              onChange={(event) => onLabelFormChange({ ...labelForm, name: event.target.value })}
              placeholder="Documentation"
              required
              value={labelForm.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label-color">Color</Label>
            <Input
              aria-label="Label color"
              className="h-9"
              id="label-color"
              onChange={(event) => onLabelFormChange({ ...labelForm, color: event.target.value })}
              type="color"
              value={labelForm.color}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" type="submit">
              {editingLabelId ? "Update Label" : "Add Label"}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {labels.map((label) => (
            <div
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3"
              key={label.id}
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                <span>{label.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => onStartEdit(label)} size="sm" type="button" variant="ghost">
                  Edit
                </Button>
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void onDelete(label.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
