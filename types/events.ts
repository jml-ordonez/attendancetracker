export type EventCategory = "Seminar" | "Lecture" | "Workshop" | "Conference" | "Meeting" | "General Assembly";

export type EventStatus = "draft" | "published" | "in_progress" | "completed" | "cancelled" | "archived";

export type CheckpointType = "time_in" | "time_out" | "interim";

export type AttendanceClassification =
  | "on_time"
  | "late"
  | "present"
  | "checked_out"
  | "absent"
  | "left_early"
  | "incomplete"
  | "pending_verification"
  | "excused"
  | "corrected";

export interface EventSession {
  id: string;
  event_id: string;
  title: string;
  session_date: string;
  time_in_start: string;
  time_in_end: string;
  time_out_start: string;
  time_out_end: string;
  grace_period_mins: number;
  order_index: number;
  checkpoints?: EventCheckpoint[];
}

export interface EventCheckpoint {
  id: string;
  session_id: string;
  name: string;
  checkpoint_type: CheckpointType;
  sequence_order: number;
}

export interface BAEvent {
  id: string;
  title: string;
  description: string;
  /** Only on older events; new events have no category. */
  category?: EventCategory;
  venue: string;
  start_time: string;
  end_time: string;
  organizer_id: string;
  organizer_name?: string;
  status: EventStatus;
  certificate_enabled: boolean;
  /** 0 when there is no minimum stay (the default for new events). */
  min_attendance_duration_mins: number;
  sessions?: EventSession[];
  expected_attendees?: number;
  actual_attendees?: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name?: string;
  student_id_number?: string;
  student_major?: string;
  student_year?: number;
  student_section?: string;
  event_id: string;
  event_title?: string;
  session_id: string;
  session_title?: string;
  time_in_timestamp: string | null;
  time_out_timestamp: string | null;
  time_in_status: "on_time" | "late" | "excused" | null;
  time_out_status: "normal" | "early_departure" | null;
  final_status: AttendanceClassification;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}
