import { redirect } from "next/navigation";

// Weight moved to the Profile page in Round 24 (steps were removed). Old links still work.
export default function BodyPage() {
  redirect("/profile");
}
