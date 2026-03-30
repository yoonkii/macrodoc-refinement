"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Info, PanelRightOpen, PanelRightClose, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AppHeaderProps {
  showStylePanel: boolean;
  onToggleStylePanel: () => void;
  onToggleMobileDrawer: () => void;
}

export function AppHeader({
  showStylePanel,
  onToggleStylePanel,
  onToggleMobileDrawer,
}: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [aboutOpen, setAboutOpen] = useState(false);

  function handleThemeToggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40",
          "backdrop-blur-md bg-[var(--bg)]/80",
          "border-b border-[var(--border)]"
        )}
      >
        <div className="flex items-center h-14 px-5">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="md:hidden p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* App title */}
          <h1 className="font-display text-[22px] font-bold text-[var(--text)]">
            MacroDocRefinement
          </h1>

          <div className="flex-1" />

          {/* Desktop: style panel toggle */}
          <button
            type="button"
            onClick={onToggleStylePanel}
            className={cn(
              "hidden md:inline-flex p-2 rounded-lg transition-colors",
              showStylePanel
                ? "text-[var(--amber)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
            aria-label={showStylePanel ? "Hide Style Panel" : "Show Style Panel"}
          >
            {showStylePanel ? (
              <PanelRightClose className="size-5" />
            ) : (
              <PanelRightOpen className="size-5" />
            )}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={handleThemeToggle}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </button>

          {/* Info button */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="About"
          >
            <Info className="size-5" />
          </button>
        </div>
      </header>

      {/* About dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              About MacroDocRefinement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[var(--text)]">
            <p className="font-semibold">
              AI-powered personal voice engine that refines your text with
              platform presets and personality modes.
            </p>
            <div>
              <p className="mb-2">Key features:</p>
              <ul className="list-disc list-inside space-y-1 text-[var(--text-muted)]">
                <li>Tone spectrum from formal to casual</li>
                <li>Platform presets (LinkedIn, X, Instagram, Substack)</li>
                <li>Personality modes (MDR, Professional, Casual, Academic)</li>
                <li>Maintains original meaning and language</li>
                <li>
                  Highlighted differences between original and refined text
                </li>
              </ul>
            </div>
            <p className="text-[var(--text-muted)]">
              Maximum input length: 10,000 characters
            </p>
          </div>
          <DialogFooter showCloseButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
