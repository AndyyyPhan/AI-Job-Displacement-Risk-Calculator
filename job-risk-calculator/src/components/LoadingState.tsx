interface Props {
  label: string
  sublabel?: string
}

export function LoadingState({ label, sublabel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
      <p className="text-lg font-medium text-slate-800">{label}</p>
      {sublabel && <p className="text-sm text-slate-500">{sublabel}</p>}
    </div>
  )
}
