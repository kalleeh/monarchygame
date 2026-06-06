/** Season status badge — extracted from AdminDashboard.tsx. */
export function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active' ? 'badge badge--active' : status === 'transitioning' ? 'badge badge--transitioning' : 'badge badge--completed';
  return <span className={cls}>{status}</span>;
}
