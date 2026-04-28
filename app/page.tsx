import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";

export default async function Home() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/force-password-change");
  if (session.user.role === "ADMIN") redirect("/dashboard");
  redirect("/companies");
}
