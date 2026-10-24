"use client";

import React, { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { getRegisteredStudent, registerStudent } from "@/lib/auth/session";
import {
  EMAIL_PATTERN,
  MAJORS,
  NAME_PATTERN,
  SECTION_PATTERN,
  STUDENT_ID_PATTERN,
  YEAR_LEVELS,
  sectionMatchesMajor,
  sectionMatchesYear,
} from "@/lib/validation";

interface StudentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Open the pass after saving. Off when editing from the pass page itself. */
  goToPass?: boolean;
}

function suggestSection(majorCode: string, yearLevel: string): string {
  const year = Math.max(1, YEAR_LEVELS.indexOf(yearLevel as (typeof YEAR_LEVELS)[number]) + 1);
  return `BA-${majorCode.replace("BSBA-", "")} ${year}-1`;
}

type Errors = Partial<Record<"firstName" | "lastName" | "studentIdNumber" | "email" | "section" | "form", string>>;

export function StudentRegisterModal({ isOpen, onClose, onSuccess, goToPass = true }: StudentRegisterModalProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [majorCode, setMajorCode] = useState("BSBA-MM");
  const [yearLevel, setYearLevel] = useState<string>("1st Year");
  const [section, setSection] = useState("BA-MM 1-1");
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
      setMajorCode(existing.majorCode);
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
    const mail = email.trim();
    const sec = section.trim().toUpperCase();

    if (!first) errs.firstName = "Enter your first name.";
    else if (first.length > 40 || !NAME_PATTERN.test(first)) errs.firstName = "Use letters only (spaces, hyphens and apostrophes allowed).";

    if (!last) errs.lastName = "Enter your last name.";
    else if (last.length > 40 || !NAME_PATTERN.test(last)) errs.lastName = "Use letters only (spaces, hyphens and apostrophes allowed).";

    if (!sid) errs.studentIdNumber = "Enter your student ID number.";
    else if (!STUDENT_ID_PATTERN.test(sid)) errs.studentIdNumber = "Use the format YYYY-NNNNN-BA, for example 2024-01492-BA.";
    else if (Number(sid.slice(0, 4)) < 2000 || Number(sid.slice(0, 4)) > new Date().getFullYear())
      errs.studentIdNumber = "The year at the start of your ID isn't valid.";

    if (!mail) errs.email = "Enter your university email.";
    else if (!EMAIL_PATTERN.test(mail)) errs.email = "Enter a valid email address, such as name@university.edu.";

    if (!sec) errs.section = "Enter your section.";
    else if (!SECTION_PATTERN.test(sec)) errs.section = "Use the format BA-MM 3-1 (program, year-section).";
    else if (!sectionMatchesMajor(sec, majorCode)) errs.section = `Your major is ${majorCode.replace("BSBA-", "")}, so the section starts with BA-${majorCode.replace("BSBA-", "")}.`;
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
      registerStudent({
        firstName: firstName.trim().replace(/\s+/g, " "),
        lastName: lastName.trim().replace(/\s+/g, " "),
        studentIdNumber: studentIdNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        majorCode,
        yearLevel,
        section: section.trim().toUpperCase(),
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
            placeholder="2024-01492-BA"
            maxLength={13}
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
            placeholder="name@university.edu"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear("email");
            }}
          />
        </div>

        <fieldset className="grid gap-4 rounded-xl bg-paper p-4 sm:grid-cols-3">
          <legend className="sr-only">Program</legend>
          <SelectField
            label="Major"
            value={majorCode}
            onChange={(e) => {
              setMajorCode(e.target.value);
              setSection(suggestSection(e.target.value, yearLevel));
              clear("section");
            }}
          >
            {Object.entries(MAJORS).map(([code, name]) => (
              <option key={code} value={code}>
                {name.replace("BSBA in ", "")}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Year level"
            value={yearLevel}
            onChange={(e) => {
              setYearLevel(e.target.value);
              setSection(suggestSection(majorCode, e.target.value));
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
            maxLength={12}
            value={section}
            error={errors.section}
            onChange={(e) => {
              setSection(e.target.value.toUpperCase());
              clear("section");
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
