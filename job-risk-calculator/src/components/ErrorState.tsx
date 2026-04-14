interface Props {
  message: string
  onRetry: () => void
  onStartOver: () => void
}

export function ErrorState({ message, onRetry, onStartOver }: Props) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h2 className="text-xl font-semibold text-red-900">Something went wrong</h2>
      <p className="mt-3 text-sm text-red-800">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
