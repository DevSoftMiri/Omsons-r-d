export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-5 lg:p-8">
      <section className="panel">
        <h2 className="section-title">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">This module is ready for the next implementation pass.</p>
      </section>
    </div>
  );
}
