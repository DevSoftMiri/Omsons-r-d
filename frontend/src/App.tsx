import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppSelector } from './hooks';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CreateProject } from './pages/projects/CreateProject';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { Attachments } from './pages/projects/workspace/Attachments';
import { Benchmarking } from './pages/projects/workspace/Benchmarking';
import { BOM } from './pages/projects/workspace/BOM';
import { CustomStage } from './pages/projects/workspace/CustomStage';
import { FinalStage } from './pages/projects/workspace/FinalStage';
import { Overview } from './pages/projects/workspace/Overview';
import { Prerequisites } from './pages/projects/workspace/Prerequisites';
import { ProductDesign } from './pages/projects/workspace/ProductDesign';
import { Programming } from './pages/projects/workspace/Programming';
import { ProjectLayout } from './pages/projects/workspace/ProjectLayout';
import { TestingValidation } from './pages/projects/workspace/TestingValidation';

export function App() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="prerequisites" element={<Prerequisites />} />
        <Route path="benchmarking" element={<Benchmarking />} />
        <Route path="attachments" element={<Attachments />} />
        <Route path="bom" element={<BOM />} />
        <Route path="product-design" element={<ProductDesign />} />
        <Route path="programming" element={<Programming />} />
        <Route path="testing-validation" element={<TestingValidation />} />
        <Route path="reporting" element={<Navigate to="../testing-validation" replace />} />
        <Route path="custom-stage/:stageSlug" element={<CustomStage />} />
        <Route path="final-stage" element={<FinalStage />} />
      </Route>

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/create" element={<CreateProject />} />
        <Route path="team" element={<PlaceholderPage title="Team Members" />} />
        <Route path="vendors" element={<PlaceholderPage title="Vendors" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
    </Routes>
  );
}
