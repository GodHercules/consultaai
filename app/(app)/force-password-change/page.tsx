import { ForcePasswordChangeForm } from "@/components/auth/force-password-change-form";

export const dynamic = "force-dynamic";

export default function ForcePasswordChangePage() {
  return (
    <div className="flex justify-center">
      <ForcePasswordChangeForm />
    </div>
  );
}

