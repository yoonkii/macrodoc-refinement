"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStyleProfilesStore } from "@/lib/stores/style-profiles";
import type { StyleProfile, ProfileType } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface StylePanelProps {
  isInDrawer?: boolean;
}

export function StylePanel({ isInDrawer = false }: StylePanelProps) {
  const store = useStyleProfilesStore();
  const profiles = store.profiles;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StyleProfile | null>(
    null
  );
  const [deletingProfile, setDeletingProfile] = useState<StyleProfile | null>(
    null
  );

  const platformProfiles = profiles.filter((p) => p.type === "platform");
  const personalityProfiles = profiles.filter((p) => p.type === "personality");
  const customProfiles = profiles.filter(
    (p) => p.type === "custom" || p.type === "learned"
  );

  function handleAdd() {
    setEditingProfile(null);
    setEditDialogOpen(true);
  }

  function handleEdit(profile: StyleProfile) {
    setEditingProfile(profile);
    setEditDialogOpen(true);
  }

  function handleDeleteRequest(profile: StyleProfile) {
    setDeletingProfile(profile);
    setDeleteDialogOpen(true);
  }

  function handleDeleteConfirm() {
    if (deletingProfile) {
      store.deleteProfile(deletingProfile.id);
    }
    setDeleteDialogOpen(false);
    setDeletingProfile(null);
  }

  function handleSave(
    name: string,
    instructions: string,
    fewShots: string[]
  ) {
    if (editingProfile) {
      store.updateProfile({
        ...editingProfile,
        name,
        instructions,
        fewShots,
      });
    } else {
      const newProfile: StyleProfile = {
        id: "",
        name,
        instructions,
        fewShots,
        isActive: false,
        type: "custom" as ProfileType,
        toneBaseline: 0,
        charLimit: null,
      };
      store.addProfile(newProfile);
    }
    setEditDialogOpen(false);
    setEditingProfile(null);
  }

  const content = (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {platformProfiles.length > 0 && (
          <ProfileSection
            title="Platform Presets"
            profiles={platformProfiles}
            onToggle={(id) => store.toggleProfileActive(id)}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        )}
        {personalityProfiles.length > 0 && (
          <ProfileSection
            title="Personality Modes"
            profiles={personalityProfiles}
            onToggle={(id) => store.toggleProfileActive(id)}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        )}
        {customProfiles.length > 0 && (
          <ProfileSection
            title="Custom"
            profiles={customProfiles}
            onToggle={(id) => store.toggleProfileActive(id)}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        )}
      </div>

      {/* Add new style button */}
      <div className="p-4">
        <button
          type="button"
          onClick={handleAdd}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-sm font-medium hover:bg-[var(--amber-hover)] transition-colors"
        >
          <Plus className="size-4" />
          Add New Style
        </button>
      </div>

      {/* Edit/Add dialog */}
      <ProfileFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title={editingProfile ? "Edit Style" : "Add New Style"}
        initialName={editingProfile?.name ?? ""}
        initialInstructions={editingProfile?.instructions ?? ""}
        initialFewShots={editingProfile?.fewShots ?? []}
        onSave={handleSave}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              Delete Style?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text)]">
            Are you sure you want to delete &ldquo;{deletingProfile?.name}
            &rdquo;?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (isInDrawer) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-1 text-center">
        <h2 className="font-display text-lg font-bold text-[var(--amber)] mb-6">
          Style Profiles
        </h2>
      </div>
      {content}
    </div>
  );
}

// ---------- Section ----------

interface ProfileSectionProps {
  title: string;
  profiles: StyleProfile[];
  onToggle: (id: string) => void;
  onEdit: (profile: StyleProfile) => void;
  onDelete: (profile: StyleProfile) => void;
}

function ProfileSection({
  title,
  profiles,
  onToggle,
  onEdit,
  onDelete,
}: ProfileSectionProps) {
  return (
    <div className="mb-4">
      <p className="px-3 mt-6 mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        {title}
      </p>
      {profiles.map((profile) => (
        <ProfileTile
          key={profile.id}
          profile={profile}
          onToggle={() => onToggle(profile.id)}
          onEdit={() => onEdit(profile)}
          onDelete={() => onDelete(profile)}
        />
      ))}
    </div>
  );
}

// ---------- Tile ----------

interface ProfileTileProps {
  profile: StyleProfile;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProfileTile({ profile, onToggle, onEdit, onDelete }: ProfileTileProps) {
  return (
    <div className="px-1 py-1">
      <GlassCard>
        <div>
          {/* Name + switch row */}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-display text-sm font-semibold text-[var(--text)] truncate">
                {profile.name}
              </span>
              {profile.charLimit != null && (
                <span className="shrink-0 font-mono text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--amber-dim)] text-[var(--amber)]">
                  {profile.charLimit} chars
                </span>
              )}
            </div>
            <Switch
              checked={profile.isActive}
              onCheckedChange={onToggle}
              className={cn(
                profile.isActive &&
                  "data-checked:bg-[var(--amber)]"
              )}
            />
          </div>

          {/* Instructions preview */}
          <p className="px-4 pb-3.5 font-sans text-[13px] text-[var(--text-muted)] leading-snug line-clamp-2">
            {profile.instructions}
          </p>

          {/* Footer actions */}
          <div className="border-t border-black/[0.04] dark:border-white/[0.04] flex justify-end gap-1 px-2 py-1">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs text-[var(--error)] hover:text-[var(--error)] transition-colors"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ---------- Form Dialog ----------

interface ProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName: string;
  initialInstructions: string;
  initialFewShots: string[];
  onSave: (name: string, instructions: string, fewShots: string[]) => void;
}

function ProfileFormDialog({
  open,
  onOpenChange,
  title,
  initialName,
  initialInstructions,
  initialFewShots,
  onSave,
}: ProfileFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [fewShots, setFewShots] = useState<string[]>(
    initialFewShots.length > 0 ? [...initialFewShots] : [""]
  );

  // Reset form when dialog opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setName(initialName);
      setInstructions(initialInstructions);
      setFewShots(
        initialFewShots.length > 0 ? [...initialFewShots] : [""]
      );
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const validFewShots = fewShots
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    onSave(trimmedName, instructions.trim(), validFewShots);
  }

  function addFewShot() {
    setFewShots((prev) => [...prev, ""]);
  }

  function removeFewShot(index: number) {
    setFewShots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFewShot(index: number, value: string) {
    setFewShots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Style Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Professional, Casual, Academic"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Style Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe how text should be refined"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Few-shots */}
          <div>
            <p className="text-sm font-medium text-[var(--text)] mb-2">
              Few-Shot Examples (Optional)
            </p>
            {fewShots.map((shot, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <textarea
                  value={shot}
                  onChange={(e) => updateFewShot(index, e.target.value)}
                  placeholder='Example: Instead of X, write Y'
                  rows={2}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:ring-2 focus:ring-amber-500/40"
                />
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removeFewShot(index)}
                    className="self-start p-2 text-[var(--error)] hover:bg-[var(--error-dim)] rounded-lg transition-colors"
                    aria-label="Remove example"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFewShot}
              className="inline-flex items-center gap-1 text-sm text-[var(--amber)] hover:text-[var(--amber-hover)] transition-colors"
            >
              <Plus className="size-4" />
              Add Example
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={cn(
              "inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              name.trim()
                ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)]"
                : "bg-[var(--elevated)] text-[var(--text-muted)] cursor-not-allowed"
            )}
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
