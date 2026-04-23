import type { BacklogItem, Issue } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BacklogProps {
  backlogItems: BacklogItem[];
  issues: Issue[];
}

export function Backlog({ backlogItems, issues }: BacklogProps) {
  if (!backlogItems.length && !issues.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backlog</CardTitle>
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
            <div
              key={`issue-${issue.number}`}
              className="p-3 rounded-lg border border-border bg-muted/20 space-y-2"
            >
              <Badge variant="outline" className="text-xs">
                issue #{issue.number}
              </Badge>
              <div className="font-medium text-sm text-foreground">
                {issue.title}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}