"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { setStaffStatus } from "@/server/actions/staff";

export function StaffStatusToggle({ id, status }: { id: string; status: "ACTIVE" | "DISABLED" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  return (
    <Button variant="outline" size="sm" disabled={pending}
      onClick={() => startTransition(async () => {
        const res = await setStaffStatus(id, next);
        if (!res.ok) return toast({ title: res.error, variant: "error" });
        router.refresh();
      })}>
      {status === "ACTIVE" ? "Disable" : "Enable"}
    </Button>
  );
}
