import { Download, FileText, Printer, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../hooks';
import { certificateStatus, readCertificates, readReports, saveReports, type GeneratedReport } from '../services/adminModuleStorage';
import { fetchProjects } from '../services/projectService';
import { setProjects } from '../store';
import type { Project } from '../types';

const reportTypes = ['Project Summary Report', 'Project Progress Report', 'Testing & Validation Report', 'BOM Report', 'Team Assignment Report', 'Vendor Report', 'Certificate Report'];

export function ReportsPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const user = useAppSelector((state) => state.auth.user);
  const { showToast } = useToast();
  const [projectId, setProjectId] = useState('All Projects');
  const [reportType, setReportType] = useState(reportTypes[0]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<GeneratedReport | null>(null);
  const [recent, setRecent] = useState<GeneratedReport[]>(() => readReports());

  useEffect(() => {
    fetchProjects().then((items) => dispatch(setProjects(items))).catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    saveReports(recent);
  }, [recent]);

  const projectScope = useMemo(() => projects.filter((project) => {
    const matchesProject = projectId === 'All Projects' || project.id === projectId;
    const startTime = project.startDate ? new Date(project.startDate).getTime() : 0;
    const matchesFrom = !from || startTime >= new Date(from).getTime();
    const matchesTo = !to || startTime <= new Date(to).getTime();
    return matchesProject && matchesFrom && matchesTo;
  }), [from, projectId, projects, to]);

  function generate() {
    const rows = buildRows(reportType, projectScope);
    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      name: reportType,
      type: reportType,
      projectId,
      generatedBy: user?.name || 'Admin',
      generatedAt: new Date().toISOString(),
      rows
    };
    setPreview(report);
    setRecent((current) => [report, ...current].slice(0, 12));
    showToast({ tone: 'success', title: 'Report generated', message: `${rows.length} row${rows.length === 1 ? '' : 's'} included.` });
  }

  function exportCsv(report: GeneratedReport) {
    const headers = Object.keys(report.rows[0] || { Empty: '' });
    const csv = [headers.join(','), ...report.rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.name.replace(/\s+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Reports" subtitle="Generate and export R&D project reports" />

      <section className="mb-5 rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_160px_auto]">
          <Field label="Project"><select className="field h-11" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option>All Projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.productCode} - {project.name}</option>)}</select></Field>
          <Field label="Report Type"><select className="field h-11" value={reportType} onChange={(event) => setReportType(event.target.value)}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="From"><input type="date" className="field h-11" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
          <Field label="To"><input type="date" className="field h-11" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
          <button className="primary-button mt-6 h-11 justify-center" onClick={generate}><Search size={17} />Generate Report</button>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-[#dde6f2] bg-white p-5 shadow-sm print:shadow-none">
        {preview ? (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#06143d]">{preview.name}</h2>
                <p className="text-sm font-semibold text-[#53688d]">Generated: {new Date(preview.generatedAt).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button className="secondary-button h-10" onClick={printReport}><Download size={16} />Print / Save PDF</button>
                <button className="secondary-button h-10" onClick={() => exportCsv(preview)}><Download size={16} />Export Excel</button>
                <button className="secondary-button h-10" onClick={printReport}><Printer size={16} />Print</button>
              </div>
            </div>
            <ReportTable rows={preview.rows} />
          </>
        ) : (
          <div className="py-12 text-center text-sm text-[#53688d]"><FileText className="mx-auto mb-3 text-[#7a8aa8]" size={38} /><p className="font-bold text-[#06143d]">Generate a report to preview it here</p><p>Reports use project, team, BOM, vendor and certificate data already in the app.</p></div>
        )}
      </section>

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-sm print:hidden">
        <h2 className="mb-4 text-xl font-bold text-[#06143d]">Recently Generated Reports</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-left">
            <thead><tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]">{['Report Name', 'Report Type', 'Generated By', 'Generated Date', 'Project', 'Actions'].map((head) => <th key={head} className="px-4 py-3 first:rounded-l-lg last:rounded-r-lg">{head}</th>)}</tr></thead>
            <tbody>{recent.map((report) => <tr key={report.id} className="border-b border-[#e2e8f2] last:border-b-0">
              <td className="px-4 py-4 font-bold text-[#06143d]">{report.name}</td>
              <td className="px-4 py-4 text-sm text-[#53688d]">{report.type}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#20385f]">{report.generatedBy}</td>
              <td className="px-4 py-4 text-sm text-[#53688d]">{new Date(report.generatedAt).toLocaleString('en-IN')}</td>
              <td className="px-4 py-4 text-sm text-[#53688d]">{report.projectId === 'All Projects' ? 'All Projects' : projects.find((project) => project.id === report.projectId)?.productCode || '--'}</td>
              <td className="px-4 py-4"><div className="flex gap-2"><button className="secondary-button h-8" onClick={() => setPreview(report)}>View</button><button className="icon-button h-8 w-8" onClick={() => exportCsv(report)}><Download size={15} /></button><button className="icon-button h-8 w-8 text-rose-600" onClick={() => setRecent((current) => current.filter((item) => item.id !== report.id))}><Trash2 size={15} /></button></div></td>
            </tr>)}</tbody>
          </table>
          {!recent.length ? <p className="py-8 text-center text-sm text-[#53688d]">No reports generated yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function buildRows(type: string, projects: Project[]) {
  if (type === 'Project Progress Report') {
    return projects.map((project) => ({
      Project: project.productCode,
      'Completed Stages': project.stages.filter((stage) => stage.status === 'Completed').length,
      'Current Stage': project.currentStage,
      'Pending Stages': project.stages.filter((stage) => stage.status !== 'Completed').length,
      Progress: `${project.progress}%`
    }));
  }
  if (type === 'Testing & Validation Report') {
    return projects.map((project) => ({ Project: project.productCode, 'Tests Performed': project.stages.some((stage) => stage.name === 'Testing & Validation') ? 'Testing & Validation' : '--', 'Test Status': project.stages.find((stage) => stage.name === 'Testing & Validation')?.status || '--', Results: project.progress >= 100 ? 'Completed' : 'In progress', Remarks: project.description, 'Validation Status': project.currentStage === 'Final Stage' ? 'Ready' : 'Pending' }));
  }
  if (type === 'BOM Report') {
    return projects.flatMap((project) => project.bom.map((item) => ({ Project: project.productCode, Material: item.materialName, Quantity: item.quantity, Specification: `${item.leadTimeDays} day lead time`, Vendor: item.vendor, 'BOM Status': item.procurementStage })));
  }
  if (type === 'Team Assignment Report') {
    const rows = new Map<string, Record<string, string | number>>();
    projects.forEach((project) => project.teamMembers.forEach((member) => rows.set(member.name, { 'Team Member': member.name, Role: member.role, 'Assigned Projects': projects.filter((item) => item.teamMembers.some((candidate) => candidate.name === member.name)).map((item) => item.productCode).join(', '), 'Reporting Manager': project.reportTo, Responsibility: project.currentStage })));
    return Array.from(rows.values());
  }
  if (type === 'Vendor Report') {
    const rows = new Map<string, Record<string, string | number>>();
    projects.forEach((project) => project.bom.forEach((item) => rows.set(item.vendor, { Vendor: item.vendor, Category: item.materialName, Contact: '--', 'Products/Materials Supplied': item.materialName, 'Associated Projects': projects.filter((candidate) => candidate.bom.some((bom) => bom.vendor === item.vendor)).map((candidate) => candidate.productCode).join(', '), Status: 'Active' })));
    return Array.from(rows.values());
  }
  if (type === 'Certificate Report') {
    return readCertificates().map((certificate) => ({ Certificate: certificate.name, Project: projects.find((project) => project.id === certificate.projectId)?.productCode || '--', Type: certificate.type, 'Issue Date': certificate.issueDate, 'Expiry Date': certificate.expiryDate, Status: certificateStatus(certificate.expiryDate) }));
  }
  return projects.map((project) => ({ Project: project.productCode, 'Project Lead': project.teamMembers[0]?.name || '--', 'Reporting Manager': project.reportTo, 'Assigned Staff': project.teamMembers.map((member) => member.name).join(', '), 'Current Stage': project.currentStage, Progress: `${project.progress}%`, 'Start Date': project.startDate, 'Target Date': project.targetDate, Status: project.status }));
}

function ReportTable({ rows }: { rows: Array<Record<string, string | number>> }) {
  const headers = Object.keys(rows[0] || {});
  if (!rows.length) return <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-[#53688d]">No data available for this report.</p>;
  return <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left"><thead><tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]">{headers.map((head) => <th key={head} className="px-4 py-3 first:rounded-l-lg last:rounded-r-lg">{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-[#e2e8f2] last:border-b-0">{headers.map((head) => <td key={head} className="px-4 py-3 text-sm text-[#20385f]">{row[head]}</td>)}</tr>)}</tbody></table></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-sm font-bold text-[#20385f]">{label}</span>{children}</label>;
}
