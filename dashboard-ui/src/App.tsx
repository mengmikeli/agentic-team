import { useState, useEffect, useRef, useCallback } from 'react';

// Swipe gesture detection for mobile project switching
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    // Horizontal swipe: must travel >80px and be more horizontal than vertical
    if (absDx > 80 && absDx > absDy * 1.5) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    touchStart.current = null;
  }, [onSwipeLeft, onSwipeRight]);
  
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
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
import { AnalyticsView } from './components/analytics-view';
import { Skeleton } from './components/ui/skeleton';
import { ErrorBoundary } from './components/error-boundary';
import { LoopStatusBanner } from './components/loop-status';

function App() {
  const [currentTab, setCurrentTab] = useState<'project' | 'tokens' | 'analytics'>('project');
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

  // Swipe left = next project, swipe right = previous project
  const swipeToNext = useCallback(() => {
    if (!currentProject || projects.length <= 1) return;
    const idx = projects.findIndex(p => p.name === currentProject.name);
    if (idx < projects.length - 1) handleProjectChange(projects[idx + 1]);
  }, [currentProject, projects]);
  
  const swipeToPrev = useCallback(() => {
    if (!currentProject || projects.length <= 1) return;
    const idx = projects.findIndex(p => p.name === currentProject.name);
    if (idx > 0) handleProjectChange(projects[idx - 1]);
  }, [currentProject, projects]);
  
  useSwipe(swipeToNext, swipeToPrev);

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
      <LoopStatusBanner projects={projects.map(p => ({ name: p.name, path: p.path }))} />
      
      <main className="container mx-auto px-4 md:px-6 py-4 space-y-4">
        {currentTab === 'analytics' ? (
          <AnalyticsView />
        ) : currentTab === 'tokens' ? (
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
