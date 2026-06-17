"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { setCouponStatus } from "@/server/actions/coupons";

export function CouponStatusToggle({ id, status }: { id: string; status: "ACTIVE" | "DISABLED" | "EXPIRED" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  if (status === "EXPIRED") return <Button variant="outline" size="sm" disabled>Expired</Button>;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setCouponStatus(id, next);
          if (!res.ok) return toast({ title: res.error, variant: "error" });
          router.refresh();
        })
      }
    >
      {status === "ACTIVE" ? "Disable" : "Enable"}
    </Button>
  );
}
