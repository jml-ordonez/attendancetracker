"use client";

import React, { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { getRegisteredStudent, registerStudent } from "@/lib/auth/session";
import {
  NAME_PATTERN,
  SECTION_PATTERN,
  STUDENT_ID_PATTERN,
  UA_EMAIL_PATTERN,
  YEAR_LEVELS,
  deriveMajorFromSection,
  sectionMatchesYear,
} from "@/lib/validation";

interface StudentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Open the pass after saving. Off when editing from the pass page itself. */
  goToPass?: boolean;
}

function suggestSection(yearLevel: string, currentSec = "MM-1A"): string {
  const year = Math.max(1, YEAR_LEVELS.indexOf(yearLevel as (typeof YEAR_LEVELS)[number]) + 1);
  const prefix = currentSec.match(/^(?:BA-)?([A-Z]+)/)?.[1] || "MM";
  const suffix = currentSec.match(/[A-Z0-9]$/)?.[0] || "A";
  return `${prefix}-${year}${suffix}`;
}

type Errors = Partial<Record<"firstName" | "lastName" | "studentIdNumber" | "email" | "section" | "form", string>>;

export function StudentRegisterModal({ isOpen, onClose, onSuccess, goToPass = true }: StudentRegisterModalProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [yearLevel, setYearLevel] = useState<string>("1st Year");
  const [section, setSection] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Prefill when the dialog opens over an existing registration.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    const existing = isOpen ? getRegisteredStudent() : null;
    if (isOpen) setIsEdit(!!existing);
    if (existing) {
      setFirstName(existing.firstName);
      setLastName(existing.lastName);
      setStudentIdNumber(existing.studentIdNumber);
      setEmail(existing.email);
      setYearLevel(existing.yearLevel);
      setSection(existing.section);
    }
  }

  // Don't come back stuck on "Saving…" when this page is shown again.
  useLayoutEffect(
    () => () => {
      setIsSubmitting(false);
      setErrors({});
    },
    []
  );

  const clear = (key: keyof Errors) => setErrors((prev) => (prev[key] || prev.form ? { ...prev, [key]: undefined, form: undefined } : prev));

  const validate = (): Errors => {
    const errs: Errors = {};
    const first = firstName.trim();
    const last = lastName.trim();
    const sid = studentIdNumber.trim().toUpperCase();
    const mail = email.trim().toLowerCase();
    const sec = section.trim().toUpperCase();

    if (!first) errs.firstName = "Enter your first name.";
    else if (first.length > 40 || !NAME_PATTERN.test(first)) errs.firstName = "Use letters only (spaces, hyphens and apostrophes allowed).";

    if (!last) errs.lastName = "Enter your last name.";
    else if (last.length > 40 || !NAME_PATTERN.test(last)) errs.lastName = "Use letters only (spaces, hyphens and apostrophes allowed).";

    if (!sid) errs.studentIdNumber = "Enter your student ID number.";
    else if (!STUDENT_ID_PATTERN.test(sid)) errs.studentIdNumber = "Use the format e.g 2022001234.";
    else {
      const digits = sid.replace(/\D/g, "");
      const year = Number(digits.slice(0, 4));
      if (year < 2000 || year > new Date().getFullYear()) {
        errs.studentIdNumber = "The year at the start of your ID isn't valid.";
      }
    }

    if (!mail) errs.email = "Enter your university email.";
    else if (!UA_EMAIL_PATTERN.test(mail)) errs.email = "Enter a valid university email ending with @ua.edu.ph.";

    if (!sec) errs.section = "Enter your section.";
    else if (!SECTION_PATTERN.test(sec)) errs.section = "Use the format MM-1A (program, year and section).";
    else if (!sectionMatchesYear(sec, yearLevel)) errs.section = `The year in your section doesn't match ${yearLevel}.`;

    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus());
      return;
    }

    setIsSubmitting(true);
    try {
      const sid = studentIdNumber.trim().toUpperCase();
      const mail = email.trim().toLowerCase();
      const sec = section.trim().toUpperCase();
      const derivedMajor = deriveMajorFromSection(sec);

      registerStudent({
        firstName: firstName.trim().replace(/\s+/g, " "),
        lastName: lastName.trim().replace(/\s+/g, " "),
        studentIdNumber: sid,
        email: mail,
        majorCode: derivedMajor,
        yearLevel,
        section: sec,
      });
      onSuccess?.();
      onClose();
      setIsSubmitting(false);
      if (goToPass) router.push("/student/qr");
    } catch {
      setErrors({ form: "We couldn't save your details on this device. Check that private browsing is off, then try again." });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Update your details" : "Register for your attendance pass"}
      description="Enter your details exactly as they appear on your university ID. They are saved on this device only."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errors.form && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2.5 text-sm font-medium text-rose">
            {errors.form}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required autoComplete="given-name" maxLength={40} value={firstName} error={errors.firstName} onChange={(e) => { setFirstName(e.target.value); clear("firstName"); }} />
          <Field label="Last name" required autoComplete="family-name" maxLength={40} value={lastName} error={errors.lastName} onChange={(e) => { setLastName(e.target.value); clear("lastName"); }} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Student ID number"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="e.g 2022001234"
            maxLength={15}
            value={studentIdNumber}
            error={errors.studentIdNumber}
            hint="Printed on your university ID."
            onChange={(e) => {
              setStudentIdNumber(e.target.value.toUpperCase());
              clear("studentIdNumber");
            }}
          />
          <Field
            label="University email"
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@ua.edu.ph"
            value={email}
            error={errors.email}
            hint="Must end with @ua.edu.ph"
            onChange={(e) => {
              setEmail(e.target.value);
              clear("email");
            }}
          />
        </div>

        <fieldset className="grid gap-4 rounded-xl bg-paper p-4 sm:grid-cols-2">
          <legend className="sr-only">Academic details</legend>
          <SelectField
            label="Year level"
            value={yearLevel}
            onChange={(e) => {
              const newYear = e.target.value;
              setYearLevel(newYear);
              setSection((prev) => (prev ? suggestSection(newYear, prev) : ""));
              clear("section");
            }}
          >
            {YEAR_LEVELS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <Field
            label="Section"
            required
            autoComplete="off"
            placeholder="e.g MM-1A"
            maxLength={10}
            value={section}
            error={errors.section}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setSection(val);
              clear("section");
              const match = val.match(/^[A-Z]+-([1-4])/);
              if (match) {
                const yrNum = Number(match[1]);
                if (yrNum >= 1 && yrNum <= 4) {
                  setYearLevel(YEAR_LEVELS[yrNum - 1]);
                }
              }
            }}
          />
        </fieldset>

        <button type="submit" disabled={isSubmitting} className={`${btn.primary} w-full`}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              {isEdit ? "Save details" : "Save and show my pass"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

