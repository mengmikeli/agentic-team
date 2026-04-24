import { useState, useEffect } from 'react';
import type { Project } from './types';
import { useProjects } from './hooks/use-projects';
import { useFeatures } from './hooks/use-features';
import { useTokens } from './hooks/use-tokens';
import { Navigation } from './components/navigation';
import { StatusHero } from './components/status-hero';
import { StatCards } from './components/stat-cards';
import { Backlog } from './components/backlog';
import { FeatureTimeline } from './components/feature-timeline';
import { TaskBoard } from './components/task-board';
import { FeatureDetail } from './components/feature-detail';
import { TokenView } from './components/token-view';
import { Skeleton } from './components/ui/skeleton';
import { ErrorBoundary } from './components/error-boundary';
import { LoopStatusBanner } from './components/loop-status';

function App() {
  const [currentTab, setCurrentTab] = useState<'project' | 'tokens'>('project');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [tokenDays, setTokenDays] = useState(7);

  const { projects, loading: projectsLoading } = useProjects();
  const { features, issues, backlogItems, loading: _featuresLoading, sseConnected } = useFeatures(
    currentProject?.path || null
  );
  const { tokenData, loading: tokensLoading } = useTokens(tokenDays);

  // Initialize current project
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      const savedProject = localStorage.getItem('agt-dashboard-project');
      const project = savedProject 
        ? projects.find(p => p.name === savedProject) || projects[0]
        : projects[0];
      setCurrentProject(project);
    }
  }, [projects, currentProject]);

  // Save current project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('agt-dashboard-project', currentProject.name);
    }
  }, [currentProject]);

  const handleProjectChange = (project: Project) => {
    setCurrentProject(project);
    setSelectedFeature(null);
  };

  const handleFeatureChange = (featureName: string | null) => {
    setSelectedFeature(featureName);
  };

  const activeFeature = features.find(f => ['active', 'executing'].includes(f.status));
  const completedFeatures = features.filter(f => f.status === 'completed');
  const lastCompleted = completedFeatures.length > 0 
    ? completedFeatures.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0]
    : null;

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border px-6 py-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="container mx-auto px-6 py-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ErrorBoundary fallback="Navigation">
        <Navigation
          projects={projects}
          currentProject={currentProject}
          onProjectChange={handleProjectChange}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          sseConnected={sseConnected}
          isExecuting={!!activeFeature}
        />
      </ErrorBoundary>
      <LoopStatusBanner />
      
      <main className="container mx-auto px-4 md:px-6 py-4 space-y-4">
        {currentTab === 'tokens' ? (
          <ErrorBoundary fallback="TokenView">
            <TokenView tokenData={tokenData} loading={tokensLoading} days={tokenDays} onDaysChange={setTokenDays} />
          </ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary fallback="StatusHero">
              <StatusHero 
                activeFeature={activeFeature || null}
                lastCompleted={lastCompleted}
              />
            </ErrorBoundary>
            
            <ErrorBoundary fallback="StatCards">
              <StatCards features={features} currentProject={currentProject} />
            </ErrorBoundary>
            
            <ErrorBoundary fallback="Backlog">
              <Backlog backlogItems={backlogItems} issues={issues} />
            </ErrorBoundary>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ErrorBoundary fallback="FeatureTimeline">
                <FeatureTimeline
                  features={features}
                  onFeatureSelect={handleFeatureChange}
                />
              </ErrorBoundary>
              
              <ErrorBoundary fallback="TaskBoard">
                {selectedFeature ? (
                  <FeatureDetail
                    feature={features.find(f => f.name === selectedFeature) || null}
                    onClose={() => setSelectedFeature(null)}
                  />
                ) : (
                  <TaskBoard
                    features={features}
                    selectedFeature={selectedFeature}
                    onFeatureChange={handleFeatureChange}
                  />
                )}
              </ErrorBoundary>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
