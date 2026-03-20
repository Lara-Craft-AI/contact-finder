import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ProgressStep({
  current,
  total,
  company,
}: {
  current: number;
  total: number;
  company: string;
}) {
  const value = total ? (current / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Running</CardTitle>
        <CardDescription>Searching contacts via Apollo + Gemini fallback.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={value} />
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            {current} of {total}
          </span>
          <span>{company || "Starting..."}</span>
        </div>
      </CardContent>
    </Card>
  );
}
