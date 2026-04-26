import type { BacklogItem, Issue } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface BacklogProps {
  backlogItems: BacklogItem[];
  issues: Issue[];
  repoUrl?: string | null;
}

export function Backlog({ backlogItems, issues, repoUrl }: BacklogProps) {
  if (!backlogItems.length && !issues.length) {
    return null;
  }

  const issuesUrl = repoUrl ? `${repoUrl}/issues` : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Backlog</CardTitle>
          {issuesUrl && (
            <a
              href={issuesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub Issues <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {backlogItems.map((item, index) => (
            <div
              key={`backlog-${index}`}
              className="p-3 rounded-lg border border-border bg-muted/30 space-y-2"
            >
              <Badge variant="secondary" className="text-xs">
                {item.source}
              </Badge>
              <div className="font-medium text-sm text-foreground">
                {item.title}
              </div>
              {item.description && (
                <div className="text-xs text-muted-foreground line-clamp-3">
                  {item.description.slice(0, 150)}
                  {item.description.length > 150 && '...'}
                </div>
              )}
            </div>
          ))}
          
          {issues.map((issue) => (
            <a
              key={`issue-${issue.number}`}
              href={issuesUrl ? `${issuesUrl}/${issue.number}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 hover:border-primary/40 hover:bg-muted/40 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  #{issue.number}
                </Badge>
                <ExternalLink className="size-3 text-muted-foreground" />
              </div>
              <div className="font-medium text-sm text-foreground">
                {issue.title}
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
