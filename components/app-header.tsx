"use client";

import { useState, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Info, PanelRightOpen, PanelRightClose, Menu, FlaskConical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

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
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleThemeToggle() {
    if (theme === "mdr") {
      setTheme("dark");
    } else {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  }

  function handleTitleClick() {
    clickCountRef.current += 1;

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      if (theme === "mdr") {
        setTheme("dark");
      } else {
        document.documentElement.classList.add("crt-flash");
        setTimeout(() => document.documentElement.classList.remove("crt-flash"), 400);
        setTheme("mdr");
      }
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 500);
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
        <div className="flex items-center h-12 px-4">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="md:hidden p-2 -ml-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>

          {/* App title — triple-click to toggle MDR mode */}
          <h1
            onClick={handleTitleClick}
            className={cn(
              "text-base font-semibold tracking-tight text-[var(--text)] select-none cursor-default",
              theme === "mdr" && "font-mono uppercase tracking-widest"
            )}
            style={theme === "mdr" ? { textShadow: "0 0 8px rgba(124, 184, 124, 0.5)" } : undefined}
          >
            {theme === "mdr" ? "MACRO DATA REFINEMENT" : "Macro Doc Refinement."}
          </h1>

          <div className="flex-1" />

          {/* Desktop: style panel toggle */}
          <button
            type="button"
            onClick={onToggleStylePanel}
            className={cn(
              "hidden md:inline-flex items-center justify-center p-1.5 min-w-[44px] min-h-[44px] rounded-md transition-colors",
              showStylePanel
                ? "text-[var(--amber)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
            aria-label={showStylePanel ? "Hide Style Panel" : "Show Style Panel"}
          >
            {showStylePanel ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </button>

          {/* Playground link */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/playground"
                    className="hidden md:inline-flex items-center justify-center p-1.5 min-w-[44px] min-h-[44px] rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    aria-label="Style Playground"
                  >
                    <FlaskConical className="size-4" />
                  </Link>
                }
              />
              <TooltipContent side="bottom">Style Playground</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={handleThemeToggle}
            className="p-1.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label={
              theme === "mdr"
                ? "Exit MDR mode"
                : theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
            }
          >
            {theme === "mdr" ? (
              <Monitor className="size-4" />
            ) : theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </button>

          {/* Info button */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="p-1.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="About"
          >
            <Info className="size-4" />
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
