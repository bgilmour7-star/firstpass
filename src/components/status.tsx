import { STATUS_LABEL, type Status } from '@/lib/drills/schema';

// Status is shown by word and shape, never colour alone.
const STYLE: Record<Status, string> = {
  draft: 'border-border-100 text-ink-200 border-dashed',
  in_review: 'border-whistle-100 text-whistle-100',
  approved: 'border-rink-100 text-rink-100',
  live: 'border-good-100 bg-good-100 text-surface-100',
  archived: 'border-transparent bg-surface-300 text-ink-200 line-through decoration-1',
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DiagramFlag({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-surface-300 px-2.5 py-0.5 text-xs font-medium text-ink-100">
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-whistle-100" />
      {count === 1 ? 'Diagram change requested' : `${count} diagram changes requested`}
    </span>
  );
}

export { GROUP_MODEL_LABEL } from '@/lib/drills/schema';
