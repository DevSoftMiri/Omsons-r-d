import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppSelector } from './hooks';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeamMembersPage } from './pages/TeamMembersPage';
import { VendorsPage } from './pages/VendorsPage';
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
import { ProductSpecifications } from './pages/projects/workspace/ProductSpecifications';
import { Programming } from './pages/projects/workspace/Programming';
import { Prototyping } from './pages/projects/workspace/Prototyping';
import { ProjectLayout } from './pages/projects/workspace/ProjectLayout';
import { Reporting } from './pages/projects/workspace/Reporting';
import { StandardStage } from './pages/projects/workspace/StandardStage';
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
        <Route path="product-specifications" element={<ProductSpecifications />} />
        <Route path="research-data" element={<StandardStage stageName="Research Data" />} />
        <Route path="benchmarking" element={<Benchmarking />} />
        <Route path="attachments" element={<Attachments />} />
        <Route path="bom" element={<BOM />} />
        <Route path="electrical-bom" element={<BOM currentStage="Electrical BOM" />} />
        <Route path="mechanical-product-design" element={<StandardStage stageName="Mechanical Product Design" />} />
        <Route path="electrical-product-design" element={<StandardStage stageName="Electrical Product Design" />} />
        <Route path="high-level-bom" element={<StandardStage stageName="High Level BOM" />} />
        <Route path="mechanical-bom" element={<BOM currentStage="Mechanical BOM" />} />
        <Route path="product-design" element={<ProductDesign />} />
        <Route path="programming" element={<Programming />} />
        <Route path="pat-test" element={<StandardStage stageName="PAT test" />} />
        <Route path="prototyping" element={<Prototyping />} />
        <Route path="testing-validation" element={<TestingValidation />} />
        <Route path="reporting" element={<Reporting />} />
        <Route path="product-documents" element={<StandardStage stageName="Product Documents" />} />
        <Route path="custom-stage/:stageSlug" element={<CustomStage />} />
        <Route path="final-stage" element={<FinalStage />} />
      </Route>

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/create" element={user.role === 'admin' ? <CreateProject /> : <Navigate to="/projects" replace />} />
        <Route path="team" element={user.role === 'admin' ? <TeamMembersPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
