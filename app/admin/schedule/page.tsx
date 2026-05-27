import { redirect } from "next/navigation";

export default function ScheduleRedirect() {
  // Schedule is now a sub-tab of /admin/matches.
  redirect("/admin/matches");
}
