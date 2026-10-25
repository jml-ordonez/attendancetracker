"use client";

import React, { useLayoutEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField, TextAreaField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { api, ApiError } from "@/lib/client/api";
import { MAJORS, NAME_PATTERN, SECTION_PATTERN, STUDENT_ID_PATTERN, sectionMatchesMajor } from "@/lib/validation";
import type { TokenPurpose } from "@/types/qr";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  sessionId: string;
  sessionLabel: string;
  purpose: TokenPurpose;
  onSuccess?: (message: string) => void;
}

type Errors = Partial<Record<"studentIdNumber" | "studentName" | "majorCode" | "section" | "reason" | "form", string>>;

const EMPTY = { studentIdNumber: "", studentName: "", majorCode: "BSBA-MM", section: "", reason: "" };

/** Fallback when a pass can't be scanned. Every entry needs a reason and is written to the audit log. */
export function ManualEntryModal({ isOpen, onClose, eventId, sessionId, sessionLabel, purpose, onSuccess }: ManualEntryModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const isIn = purpose === "time_in";

  // Start clean each time the route is shown again.
  useLayoutEffect(() => () => {
    setForm(EMPTY);
    setErrors({});
  }, []);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const id = form.studentIdNumber.trim().toUpperCase();
    if (!id) e.studentIdNumber = "Enter the student ID number.";
    else if (!STUDENT_ID_PATTERN.test(id)) e.studentIdNumber = "Use the format e.g 2022001234.";
    if (isIn) {
      const name = form.studentName.trim();
      if (name.length < 2) e.studentName = "Enter the student's full name as printed on their ID.";
      else if (!NAME_PATTERN.test(name)) e.studentName = "Use letters only (spaces, hyphens and apostrophes allowed).";
      const sec = form.section.trim().toUpperCase();
      if (!sec) e.section = "Enter the section.";
      else if (!SECTION_PATTERN.test(sec)) e.section = "Use the format MM-1A.";
      else if (!sectionMatchesMajor(sec, form.majorCode)) e.section = "This section belongs to a different program.";
    }
    if (form.reason.trim().length < 10) e.reason = "Describe why the pass couldn't be scanned (at least 10 characters).";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ message: string; studentName: string }>("/api/attendance/manual", {
        method: "POST",
        json: {
          eventId,
          sessionId,
          purpose,
          studentIdNumber: form.studentIdNumber.trim().toUpperCase(),
          reason: form.reason.trim(),
          ...(isIn ? { studentName: form.studentName.trim(), majorCode: form.majorCode, section: form.section.trim().toUpperCase() } : {}),
        },
      });
      onSuccess?.(`${data.studentName}: ${data.message}`);
      setForm(EMPTY);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors, form: Object.keys(err.fieldErrors).length ? undefined : err.message });
      else setErrors({ form: "No connection to the server. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title={isIn ? "Manual check-in" : "Manual check-out"}
      description={`${sessionLabel}. Use only when the pass can't be scanned; the entry and your reason go to the audit log.`}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {errors.form && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2.5 text-sm font-medium text-rose">
            {errors.form}
          </p>
        )}

        <Field
          label="Student ID number"
          required
          autoComplete="off"
          placeholder="e.g 2022001234"
          maxLength={15}
          value={form.studentIdNumber}
          error={errors.studentIdNumber}
          hint={isIn ? "Check it against the student's university ID card." : "The student must already be checked in to this session."}
          onChange={(e) => set("studentIdNumber", e.target.value.toUpperCase())}
        />

        {isIn && (
          <>
            <Field
              label="Full name"
              required
              autoComplete="off"
              maxLength={80}
              value={form.studentName}
              error={errors.studentName}
              onChange={(e) => set("studentName", e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Program" value={form.majorCode} onChange={(e) => set("majorCode", e.target.value)}>
                {Object.entries(MAJORS).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name.replace("BSBA in ", "")}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Section"
                required
                autoComplete="off"
                placeholder="e.g MM-1A"
                maxLength={10}
                value={form.section}
                error={errors.section}
                onChange={(e) => set("section", e.target.value.toUpperCase())}
              />
            </div>
          </>
        )}

        <TextAreaField
          label="Reason"
          required
          rows={3}
          maxLength={300}
          placeholder="Phone screen cracked; identity checked against the student's university ID."
          value={form.reason}
          error={errors.reason}
          hint={`${form.reason.trim().length}/300 characters`}
          onChange={(e) => set("reason", e.target.value)}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={btn.primary}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Recording…" : isIn ? "Record check-in" : "Record check-out"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
