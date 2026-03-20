"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const TITLES = ["CEO", "Founder", "CTO", "VP Sales", "CFO", "Custom"];

export function TitleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target title</CardTitle>
        <CardDescription>Which role are you looking for at each company?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {TITLES.map((t) => {
            const isActive = t === "Custom" ? isCustom : !isCustom && value === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (t === "Custom") {
                    setIsCustom(true);
                    onChange("");
                  } else {
                    setIsCustom(false);
                    onChange(t);
                  }
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {isCustom && (
          <Input
            placeholder="e.g. Head of Engineering"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </CardContent>
    </Card>
  );
}
