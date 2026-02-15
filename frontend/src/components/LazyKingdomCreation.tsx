import { lazy, Suspense } from 'react';

const KingdomCreation = lazy(() => import('./KingdomCreation'));

interface LazyKingdomCreationProps {
  onKingdomCreated: () => void;
}

export function LazyKingdomCreation({ onKingdomCreated }: LazyKingdomCreationProps) {
  return (
    <Suspense fallback={<div className="loading"><p>Loading kingdom creation...</p></div>}>
      <KingdomCreation onKingdomCreated={onKingdomCreated} />
    </Suspense>
  );
}
