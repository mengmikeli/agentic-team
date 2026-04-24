import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Feature, Issue, BacklogItem } from '../types';

export function useFeatures(projectPath: string | null) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    if (!projectPath) {
      setLoading(false);
      return;
    }

    let eventSource: EventSource | null = null;
    const sseActiveRef = { current: false };

    async function loadData() {
      setLoading(true);
      try {
        const [featuresData, issuesData, backlogData] = await Promise.all([
          api.getFeatures(projectPath!),
          api.getIssues(projectPath!),
          api.getBacklog(projectPath!)
        ]);
        
        setFeatures(featuresData);
        setIssues(issuesData);
        setBacklogItems(backlogData);
      } catch (error) {
        console.error('Failed to load project data:', error);
      } finally {
        setLoading(false);
      }
    }

    function setupSSE() {
      eventSource = api.createEventSource(projectPath!);
      if (eventSource) {
        eventSource.onopen = () => {
          setSseConnected(true);
          sseActiveRef.current = true;
        };

        eventSource.onmessage = async (e) => {
          try {
            const event = JSON.parse(e.data);
            const refreshEvents = ['task-started', 'task-passed', 'task-blocked', 'feature-complete', 'feature-started'];
            if (refreshEvents.includes(event.event)) {
              // Refresh features data
              const featuresData = await api.getFeatures(projectPath!);
              setFeatures(featuresData);
            }
          } catch (error) {
            console.error('SSE message error:', error);
          }
        };

        eventSource.onerror = () => {
          setSseConnected(false);
          sseActiveRef.current = false;
        };
      }
    }

    loadData();
    setupSSE();

    // Auto-refresh fallback every 10 seconds (only when SSE is inactive)
    const refreshInterval = setInterval(async () => {
      if (sseActiveRef.current) return;
      try {
        const featuresData = await api.getFeatures(projectPath!);
        setFeatures(featuresData);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 10000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(refreshInterval);
    };
  }, [projectPath]);

  return { features, issues, backlogItems, loading, sseConnected };
}