import { redirect } from "next/navigation";

// Live points view collapsed into the main daily picker. Day navigation in
// /fantasy/team lets the user see picks + points for any past day.
export default function LiveTeamRedirect() {
  redirect("/fantasy/team");
}
