"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/server/actions/auth";

export function Topbar({ name, role, branch }: { name: string; role: string; branch?: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="text-sm text-muted-foreground">
        {branch ? <span>Branch: <span className="font-medium text-foreground">{branch}</span></span> : "All branches"}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium leading-tight">{name}</p>
          <Badge variant={role === "ADMIN" ? "default" : "secondary"} className="mt-0.5">
            {role}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="icon"
          title="Sign out"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
