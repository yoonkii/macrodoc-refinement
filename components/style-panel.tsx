"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStyleProfilesStore } from "@/lib/stores/style-profiles";
import { useToneStore } from "@/lib/stores/tone";
import type { StyleProfile } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PROOFREAD_ONLY_NAME = "Proofread Only";

interface StylePanelProps {
  isInDrawer?: boolean;
}

export function StylePanel({ isInDrawer = false }: StylePanelProps) {
  const router = useRouter();
  const store = useStyleProfilesStore();
  const toneStore = useToneStore();
  const profiles = store.profiles;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<StyleProfile | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify the Proofread Only profile and personality profiles
  const proofreadProfile = profiles.find((p) => p.name === PROOFREAD_ONLY_NAME);
  const personalityProfiles = profiles.filter(
    (p) => p.type === "personality" && p.name !== PROOFREAD_ONLY_NAME
  );
  const customProfiles = profiles.filter(
    (p) =>
      (p.type === "custom" || p.type === "learned") &&
      p.name !== PROOFREAD_ONLY_NAME
  );

  // Sort personality profiles by toneBaseline ascending (most formal first)
  const sortedPersonalityProfiles = useMemo(
    () => [...personalityProfiles].sort((a, b) => a.toneBaseline - b.toneBaseline),
    [personalityProfiles]
  );

  const anyPersonalityActive = personalityProfiles.some((p) => p.isActive);
  const isProofreadActive = proofreadProfile?.isActive ?? false;

  // Auto-toggle logic: mutual exclusivity between Proofread Only and personality modes.
  // Also sets tone based on active personality or resets to 0.0 for proofread-only.
  useEffect(() => {
    if (!proofreadProfile) return;

    // If any personality mode is active, deactivate Proofread Only
    if (anyPersonalityActive && isProofreadActive) {
      store.toggleProfileActive(proofreadProfile.id);
      return;
    }

    // If no personality mode is active and Proofread Only is not active, activate it
    if (!anyPersonalityActive && !isProofreadActive) {
      store.toggleProfileActive(proofreadProfile.id);
    }
  }, [anyPersonalityActive, isProofreadActive, proofreadProfile, store]);

  // Sync tone value to the active personality's toneBaseline
  useEffect(() => {
    const activePersonality = personalityProfiles.find((p) => p.isActive);
    if (activePersonality) {
      toneStore.setTone(activePersonality.toneBaseline);
    } else {
      // No personality active (proofread-only mode) => balanced tone
      toneStore.setTone(0.0);
    }
  }, [personalityProfiles, toneStore]);

  // When user manually toggles Proofread Only ON, turn off all personality modes
  const handleProofreadToggle = useCallback(() => {
    if (!proofreadProfile) return;

    if (!isProofreadActive) {
      // Turning ON proofread — turn off all personality modes
      for (const p of personalityProfiles) {
        if (p.isActive) {
          store.toggleProfileActive(p.id);
        }
      }
      // The useEffect will auto-activate proofread since no personality is active
    } else {
      // Turning OFF proofread — the useEffect will re-activate it if no personality is active
      // So this is effectively a no-op unless a personality gets toggled on
      store.toggleProfileActive(proofreadProfile.id);
    }
  }, [isProofreadActive, proofreadProfile, personalityProfiles, store]);

  const handleExport = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profileCount: profiles.length,
      profiles,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mdr-style-profiles.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [profiles]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const importedProfiles: unknown[] = data.profiles || data;
          if (!Array.isArray(importedProfiles)) return;

          const existingNames = new Set(profiles.map((p) => p.name));

          for (const raw of importedProfiles) {
            const profile = raw as Record<string, unknown>;
            if (
              typeof profile.name === "string" &&
              typeof profile.instructions === "string" &&
              !existingNames.has(profile.name)
            ) {
              store.addProfile({
                ...(profile as unknown as StyleProfile),
                id: crypto.randomUUID(),
              });
              existingNames.add(profile.name);
            }
          }
        } catch {
          // Invalid JSON — silently ignore
        }
      };
      reader.readAsText(file);
      // Reset so same file can be re-imported
      e.target.value = "";
    },
    [profiles, store]
  );

  function handleEdit(profile: StyleProfile) {
    // Navigate to the playground with the profile ID for full-page editing
    router.push(`/playground?edit=${profile.id}`);
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

  const content = (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* Proofread Only — standalone toggle at top */}
        {proofreadProfile && (
          <div className="mx-2 mb-4">
            <div
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg border transition-colors duration-200",
                isProofreadActive
                  ? "border-[var(--amber)]/30 bg-[var(--amber)]/5"
                  : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.09]"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                  isProofreadActive
                    ? "text-[var(--amber)]"
                    : "text-[var(--text-muted)]"
                )}
              >
                Proofread Only
              </span>
              <Switch
                checked={isProofreadActive}
                onCheckedChange={handleProofreadToggle}
                className={cn(
                  isProofreadActive && "data-checked:bg-[var(--amber)]"
                )}
              />
            </div>
          </div>
        )}

        {/* Personality Modes — sorted by formality (most formal first) */}
        {sortedPersonalityProfiles.length > 0 && (
          <ProfileSection
            title="Personality Modes"
            profiles={sortedPersonalityProfiles}
            onToggle={(id) => store.toggleProfileActive(id)}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        )}

        {/* Custom profiles */}
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

      {/* Add new style button — navigates to /playground */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => router.push("/playground")}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-1.5 h-8 rounded-full border border-[var(--amber)] text-[var(--amber)] font-sans text-xs font-medium hover:bg-[var(--amber)] hover:text-[#1A1816] transition-colors"
        >
          <Plus className="size-3.5" />
          Add New Style
        </button>
      </div>

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
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-1 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--amber)]">
            Style Profiles
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--amber)] hover:bg-white/[0.05] transition-colors"
              aria-label="Export profiles"
              title="Export profiles"
            >
              <Download className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--amber)] hover:bg-white/[0.05] transition-colors"
              aria-label="Import profiles"
              title="Import profiles"
            >
              <Upload className="size-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {content}
      </div>
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
    <div className="mb-2">
      <p className="px-3 mt-5 mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]">
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
    <div className="mx-2 mb-2 rounded-lg border border-white/[0.05] hover:border-white/[0.09] bg-white/[0.02] transition-colors duration-300">
      {/* Name + switch row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--text)] truncate">
            {profile.name}
          </span>
          {profile.charLimit != null && (
            <span className="shrink-0 font-mono text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--amber-dim)] text-[var(--amber)]">
              {profile.charLimit}
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
      <p className="px-3 pb-1 font-sans text-xs text-[var(--text-muted)] leading-snug line-clamp-2">
        {profile.instructions}
      </p>

      {/* Footer actions */}
      <div className="flex justify-end gap-1 px-2 pb-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <Pencil className="size-3" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--error)] hover:text-[var(--error)] transition-colors"
        >
          <Trash2 className="size-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

