import { useEffect, useState } from 'react';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';
import { Sun, Moon, Zap } from 'lucide-react';

interface NavigationProps {
  projects: Project[];
  currentProject: Project | null;
  onProjectChange: (project: Project) => void;
  currentTab: 'project' | 'tokens';
  onTabChange: (tab: 'project' | 'tokens') => void;
  sseConnected: boolean;
  isExecuting: boolean;
}

export function Navigation({
  projects,
  currentProject,
  onProjectChange,
  currentTab,
  onTabChange,
  sseConnected,
  isExecuting
}: NavigationProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agt-theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('agt-theme', theme);
  }, [theme]);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80" aria-label="Dashboard navigation">
      <div className="px-4 md:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            {/* Brand — accent colored */}
            <div className="font-bold font-mono tracking-tight flex items-center gap-1.5 text-sm text-primary">
              <Zap className="size-4" />
              <span>agt</span>
            </div>

            {/* View tabs */}
            <div className="flex gap-0.5" role="tablist" aria-label="Dashboard views">
              <button
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-sm transition-all",
                  currentTab === 'project'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                role="tab"
                aria-selected={currentTab === 'project'}
                onClick={() => onTabChange('project')}
              >
                Projects
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-sm transition-all",
                  currentTab === 'tokens'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                role="tab"
                aria-selected={currentTab === 'tokens'}
                onClick={() => onTabChange('tokens')}
              >
                Tokens
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {(isExecuting || sseConnected) && (
              <div className="flex items-center gap-1.5 text-xs font-medium" title={isExecuting ? 'Running' : 'Connected'}>
                <div className="relative size-2">
                  <div className={`absolute inset-0 rounded-full bg-primary ${isExecuting ? 'animate-[orbit_1.8s_ease-in-out_infinite]' : ''}`} />
                  {isExecuting && (
                    <div className="absolute inset-0 rounded-full bg-primary animate-[orbit_1.8s_ease-in-out_infinite_0.9s]" />
                  )}
                </div>
                {isExecuting && <span className="hidden sm:inline text-primary">Running</span>}
              </div>
            )}

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Project tabs — accent underline */}
        {currentTab === 'project' && projects.length > 1 && (
          <div className="flex items-center gap-0 -mb-px overflow-x-auto scrollbar-none" role="tablist" aria-label="Project selector">
            {projects.map((project) => {
              const isActive = currentProject?.name === project.name;
              return (
                <button
                  key={project.name}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onProjectChange(project)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {project.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
