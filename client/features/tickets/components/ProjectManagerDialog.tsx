import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Project, ProjectInput } from "../../../../shared/types";
import { Badge } from "../../../components/ui/badge";
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
import { cn } from "../../../lib/utils";
import { formatDateTime } from "../utils";

export function ProjectManagerDialog({
  open,
  projects,
  activeProjectSlug,
  editingProject,
  isEditingDefaultProject,
  projectForm,
  projectSaving,
  onOpenChange,
  onStartCreate,
  onSelectProject,
  onProjectFormChange,
  onSubmit,
  onSetActiveProject
}: {
  open: boolean;
  projects: Project[];
  activeProjectSlug: string;
  editingProject: Project | null;
  isEditingDefaultProject: boolean;
  projectForm: ProjectInput;
  projectSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onStartCreate: () => void;
  onSelectProject: (project: Project) => void;
  onProjectFormChange: (project: ProjectInput) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onSetActiveProject: (slug: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Project configuration</DialogTitle>
          <DialogDescription>
            Rename projects, adjust slugs, and create new workspaces from one place.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Projects
                </div>
                <div className="text-sm text-slate-500">Pick one to edit or create a new scope.</div>
              </div>
              <Button onClick={onStartCreate} size="sm" type="button" variant="outline">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>

            <div className="space-y-2">
              {projects.map((project) => {
                const isSelected = editingProject?.id === project.id;
                const isActive = activeProjectSlug === project.slug;

                return (
                  <button
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                    key={project.id}
                    onClick={() => onSelectProject(project)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{project.name}</div>
                        <div
                          className={cn(
                            "mt-1 truncate text-xs",
                            isSelected ? "text-slate-300" : "text-slate-500"
                          )}
                        >
                          @{project.slug}
                        </div>
                      </div>
                      {isActive ? (
                        <Badge variant={isSelected ? "secondary" : "outline"}>Active</Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                {editingProject ? "Edit project" : "Create project"}
              </div>
              <div className="text-xl font-semibold text-slate-900">
                {editingProject ? editingProject.name : "New project workspace"}
              </div>
              <p className="text-sm text-slate-500">
                {editingProject
                  ? "Use this panel to rename the workspace or adjust the project slug."
                  : "Create a project once here, then switch to it from the picker."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  aria-label="Project name"
                  id="project-name"
                  onChange={(event) =>
                    onProjectFormChange({ ...projectForm, name: event.target.value })
                  }
                  placeholder="Marketing site"
                  required
                  value={projectForm.name}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="project-slug">Slug</Label>
                  {isEditingDefaultProject ? (
                    <span className="text-xs font-medium text-slate-500">
                      Locked for the default workspace
                    </span>
                  ) : null}
                </div>
                <Input
                  aria-label="Project slug"
                  disabled={isEditingDefaultProject}
                  id="project-slug"
                  onChange={(event) =>
                    onProjectFormChange({ ...projectForm, slug: event.target.value })
                  }
                  placeholder="marketing-site"
                  value={projectForm.slug ?? ""}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {editingProject ? (
                  <>
                    Active project routing uses{" "}
                    <span className="font-medium text-slate-900">@{editingProject.slug}</span>.
                    {isEditingDefaultProject
                      ? " The default slug stays fixed so unscoped tickets still resolve correctly."
                      : ""}
                  </>
                ) : (
                  <>Create the workspace here, then use the project picker to jump between scopes.</>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="text-xs text-slate-500">
                  {editingProject
                    ? `Created ${formatDateTime(editingProject.createdAt)}`
                    : "Project slugs are generated automatically if left blank."}
                </div>
                <div className="flex items-center gap-2">
                  {editingProject && activeProjectSlug !== editingProject.slug ? (
                    <Button
                      onClick={() => onSetActiveProject(editingProject.slug)}
                      type="button"
                      variant="outline"
                    >
                      Set Active
                    </Button>
                  ) : null}
                  <Button disabled={projectSaving} type="submit">
                    {projectSaving ? "Saving..." : editingProject ? "Save Project" : "Create Project"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
