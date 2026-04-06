import { Folders, Plus, Tag } from "lucide-react";
import type { Project } from "../../../../shared/types";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "../../../components/ui/select";
import { projectManagerActionValue } from "../constants";

export function AppHeader({
  activeProjectSlug,
  projects,
  onProjectChange,
  onOpenProjectManager,
  onNewTicket,
  onManageLabels
}: {
  activeProjectSlug: string;
  projects: Project[];
  onProjectChange: (value: string) => void;
  onOpenProjectManager: (preferredSlug?: string) => void;
  onNewTicket: () => void;
  onManageLabels: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-500">Internal issue tracker</div>
        <h1 className="text-2xl font-semibold tracking-tight">Relay Tasks</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <Select onValueChange={onProjectChange} value={activeProjectSlug}>
            <SelectTrigger aria-label="Active project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.slug} value={project.slug}>
                  {project.name}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={projectManagerActionValue}>Configure projects</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => onOpenProjectManager(activeProjectSlug)} type="button" variant="outline">
          <Folders className="h-4 w-4" />
          Projects
        </Button>
        <Button disabled={!activeProjectSlug} onClick={onNewTicket} type="button">
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
        <Button onClick={onManageLabels} type="button" variant="outline">
          <Tag className="h-4 w-4" />
          Manage Labels
        </Button>
      </div>
    </header>
  );
}
