'use client';

export function ResourceFeedback({
  error,
  loading,
  retry,
}: {
  error: string;
  loading: boolean;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="feedback" role="alert">
        <p>{error}</p>
        <button className="btn secondary" onClick={retry}>
          다시 시도
        </button>
      </div>
    );
  return loading ? (
    <p className="muted" role="status">
      불러오는 중…
    </p>
  ) : null;
}
