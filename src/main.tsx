import { StrictMode, lazy, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { useRoute } from './router';
import { useUi } from './state/ui';
import { Workspace } from './App';

const Landing = lazy(() => import('./features/landing/Landing').then((m) => ({ default: m.Landing })));
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const DocsPage = lazy(() => import('./features/docs/DocsPage').then((m) => ({ default: m.DocsPage })));
const NewProject = lazy(() => import('./features/projects/NewProject').then((m) => ({ default: m.NewProject })));

function Root() {
  const route = useRoute();
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.title =
      route.name === 'landing' ? 'LandPlan Studio — plotted layouts in one click' : route.name === 'projects' ? 'Projects · LandPlan Studio' : route.name === 'new' ? 'New project · LandPlan Studio' : route.name === 'docs' ? 'Docs · LandPlan Studio' : 'LandPlan Studio';
  }, [route.name]);
  const fallback = <div className="drafting-grid h-full" />;
  return (
    <Suspense fallback={fallback}>
      {route.name === 'landing' && <Landing />}
      {route.name === 'projects' && <ProjectsPage />}
      {route.name === 'new' && <NewProject />}
      {route.name === 'workspace' && <Workspace key={route.id} projectId={route.id} />}
      {route.name === 'scratch' && <Workspace key="scratch" />}
      {route.name === 'docs' && <DocsPage section={route.section} />}
    </Suspense>
  );
}

// Old share links (/#s=…) open the scratch studio.
if (window.location.pathname === '/' && /[#&]s=/.test(window.location.hash)) history.replaceState(null, '', `/studio${window.location.hash}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
