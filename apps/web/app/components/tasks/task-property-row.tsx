interface TaskPropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

export function TaskPropertyRow({ icon, label, children }: TaskPropertyRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md px-4 py-1.5">
      <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="text-muted-foreground min-w-[72px] text-xs">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </div>
  );
}
