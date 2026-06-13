"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Inspector fields used to commit to the store on every keystroke, which
 * pushed undo entries and re-ran the whole map layout per character. These
 * wrappers keep a local draft and commit once on blur (or Enter where the
 * field is single-line in spirit). Escape reverts the draft.
 *
 * `onCommit` receives the draft and returns the canonical value to display —
 * so a rejected edit (e.g. blanking a label) visibly snaps back.
 */
interface DraftBehaviour {
  value: string;
  onCommit: (draft: string) => string;
  /** treat Enter (without Shift) as commit-and-blur */
  commitOnEnter?: boolean;
}

function useDraft(value: string, onCommit: (draft: string) => string) {
  const [draft, setDraft] = React.useState(value);
  const focusedRef = React.useRef(false);
  const abortRef = React.useRef(false);

  // external changes (undo, selecting via canvas) flow in while not editing
  React.useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  return {
    draft,
    setDraft,
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
      if (abortRef.current) {
        abortRef.current = false;
        setDraft(value);
        return;
      }
      setDraft(onCommit(draft));
    },
    abort: () => {
      abortRef.current = true;
    },
  };
}

type TextareaRest = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange" | "onFocus" | "onBlur" | "onKeyDown"
>;

export function DraftTextarea({
  value,
  onCommit,
  commitOnEnter,
  ...rest
}: DraftBehaviour & TextareaRest) {
  const field = useDraft(value, onCommit);
  return (
    <Textarea
      {...rest}
      value={field.draft}
      onChange={(e) => field.setDraft(e.target.value)}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
      onKeyDown={(e) => {
        if (commitOnEnter && e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          field.abort();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

type InputRest = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "onFocus" | "onBlur" | "onKeyDown"
>;

export function DraftInput({
  value,
  onCommit,
  ...rest
}: Omit<DraftBehaviour, "commitOnEnter"> & InputRest) {
  const field = useDraft(value, onCommit);
  return (
    <Input
      {...rest}
      value={field.draft}
      onChange={(e) => field.setDraft(e.target.value)}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          field.abort();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
