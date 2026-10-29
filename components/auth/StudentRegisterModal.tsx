"use client";

import React, { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { getRegisteredStudent, registerStudent } from "@/lib/auth/session";
import {
  YEAR_LEVELS,
  deriveMajorFromSection,
  fieldErrors,
  isKnownSection,
  sectionsForYear,
  studentRegistrationSchema,
  yearLevelForSection,
} from "@/lib/validation";

interface StudentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Open the pass after saving. Off when editing from the pass page itself. */
  goToPass?: boolean;
}

function normalizeStudentId(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.endsWith("-BA")) return upper;
  const digitsOnly = upper.replace(/[\s-]+/g, "");
  if (/^\d{10}$/.test(digitsOnly)) return digitsOnly;
  return upper;
}

function normalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  if (!trimmed.includes("@") && /^[a-z0-9._%+-]+$/i.test(trimmed)) {
    return `${trimmed}@ua.edu.ph`;
  }
  return trimmed;
}

type FieldKey = "firstName" | "lastName" | "studentIdNumber" | "email" | "section";
type Values = Record<FieldKey, string>;
type Errors = Partial<Record<FieldKey | "form", string>>;

/** Same rules as the pass API (see `studentRegistrationSchema`), after normalizing the ID and email. */
function validateValues(vals: Values): Errors {
  const result = studentRegistrationSchema.safeParse({
    ...vals,
    studentIdNumber: normalizeStudentId(vals.studentIdNumber),
    email: normalizeEmail(vals.email),
  });
  return result.success ? {} : fieldErrors(result.error);
}

export function StudentRegisterModal({ isOpen, onClose, onSuccess, goToPass = true }: StudentRegisterModalProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [section, setSection] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Warm the student pass route while the person fills in their details.
  useEffect(() => {
    if (isOpen && goToPass) router.prefetch("/student/qr");
  }, [isOpen, goToPass, router]);

  // Prefill when the dialog opens over an existing registration.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setIsSubmitting(false);
      setErrors({});
      const existing = getRegisteredStudent();
      setIsEdit(!!existing);
      if (existing) {
        setFirstName(existing.firstName);
        setLastName(existing.lastName);
        setStudentIdNumber(existing.studentIdNumber);
        setEmail(existing.email);
        // A section saved before the section list changed has to be chosen again.
        if (isKnownSection(existing.section)) setSection(existing.section.toUpperCase());
        else {
          setSection("");
          setErrors({ section: "The section list has changed. Select your section again." });
        }
      } else {
        setSection("");
      }
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

  const clear = (key: keyof Errors) =>
    setErrors((prev) => (prev[key] || prev.form ? { ...prev, [key]: undefined, form: undefined } : prev));

  const handleFieldBlur = (field: FieldKey, override?: Partial<Values>) => {
    const errs = validateValues({ firstName, lastName, studentIdNumber, email, section, ...override });
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const sid = normalizeStudentId(studentIdNumber);
    const mail = normalizeEmail(email);
    const sec = section.trim().toUpperCase();

    if (sid !== studentIdNumber) setStudentIdNumber(sid);
    if (mail !== email) setEmail(mail);

    const errs = validateValues({ firstName, lastName, studentIdNumber: sid, email: mail, section: sec });
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
        studentIdNumber: sid,
        email: mail,
        // Every section names its program (MM-1A → BSBA-MM).
        majorCode: deriveMajorFromSection(sec),
        yearLevel: yearLevelForSection(sec)!,
        section: sec,
      });
      onSuccess?.();
      if (goToPass) {
        router.push("/student/qr");
      } else {
        setIsSubmitting(false);
        onClose();
      }
    } catch {
      setErrors({
        form: "We couldn't save your details on this device. Check that private browsing is off, then try again.",
      });
      setIsSubmitting(false);
    }
  };

  const canSuggestEmailDomain =
    email.trim().length > 0 && !email.includes("@") && /^[a-z0-9._%+-]+$/i.test(email.trim());

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      size="lg"
      title={isEdit ? "Update your details" : "Register for your attendance pass"}
      description="Enter your details once as they appear on your university ID. Your pass stays saved on this device."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errors.form && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm font-medium text-rose">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errors.form}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            name="firstName"
            required
            autoComplete="given-name"
            maxLength={40}
            placeholder="e.g. Juan"
            disabled={isSubmitting}
            value={firstName}
            error={errors.firstName}
            onBlur={() => firstName.trim() && handleFieldBlur("firstName")}
            onChange={(e) => {
              setFirstName(e.target.value);
              clear("firstName");
            }}
          />
          <Field
            label="Last name"
            name="lastName"
            required
            autoComplete="family-name"
            maxLength={40}
            placeholder="e.g. Dela Cruz"
            disabled={isSubmitting}
            value={lastName}
            error={errors.lastName}
            onBlur={() => lastName.trim() && handleFieldBlur("lastName")}
            onChange={(e) => {
              setLastName(e.target.value);
              clear("lastName");
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Student ID number"
            name="studentIdNumber"
            required
            autoComplete="off"
            inputMode="numeric"
            autoCapitalize="characters"
            placeholder="e.g. 2022001234"
            maxLength={15}
            disabled={isSubmitting}
            value={studentIdNumber}
            error={errors.studentIdNumber}
            hint="10-digit ID printed on your university ID."
            onBlur={() => {
              if (!studentIdNumber.trim()) return;
              const normalized = normalizeStudentId(studentIdNumber);
              if (normalized !== studentIdNumber) setStudentIdNumber(normalized);
              handleFieldBlur("studentIdNumber", { studentIdNumber: normalized });
            }}
            onChange={(e) => {
              setStudentIdNumber(e.target.value.toUpperCase());
              clear("studentIdNumber");
            }}
          />
          <div>
            <Field
              label="University email"
              name="email"
              required
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="name@ua.edu.ph"
              disabled={isSubmitting}
              value={email}
              error={errors.email}
              hint={!canSuggestEmailDomain ? "Must end with @ua.edu.ph" : undefined}
              onBlur={() => {
                if (!email.trim()) return;
                const normalized = normalizeEmail(email);
                if (normalized !== email) setEmail(normalized);
                handleFieldBlur("email", { email: normalized });
              }}
              onChange={(e) => {
                setEmail(e.target.value);
                clear("email");
              }}
            />
            {canSuggestEmailDomain && !errors.email && (
              <button
                type="button"
                onClick={() => {
                  const completed = `${email.trim().toLowerCase()}@ua.edu.ph`;
                  setEmail(completed);
                  clear("email");
                }}
                className="press mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
              >
                Use {email.trim().toLowerCase()}@ua.edu.ph
              </button>
            )}
          </div>
        </div>

        <SelectField
          label="Section"
          name="section"
          required
          disabled={isSubmitting}
          value={section}
          error={errors.section}
          hint="Your year level is taken from your section."
          onChange={(e) => {
            const next = e.target.value;
            setSection(next);
            handleFieldBlur("section", { section: next });
          }}
        >
          <option value="" disabled>
            Select your section
          </option>
          {YEAR_LEVELS.map((year) => (
            <optgroup key={year} label={year}>
              {sectionsForYear(year).map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <button type="submit" disabled={isSubmitting} className={`${btn.primary} h-12 w-full text-[15px]`}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {goToPass ? "Opening your pass…" : "Saving…"}
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
