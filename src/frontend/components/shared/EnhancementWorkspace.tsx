import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EnhancementWorkspaceProps {
  title: string;
  focus: string;
  endpoints: string[];
}

export function EnhancementWorkspace({ title, focus, endpoints }: EnhancementWorkspaceProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{focus}</p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
          API ready
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {endpoints.map((endpoint) => (
          <Card key={endpoint} className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200">{endpoint}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Connected through enhancements API</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
