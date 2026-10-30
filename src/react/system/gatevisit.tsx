// src/react/system/gatevisit.tsx
import React, { lazy, Suspense, useEffect } from "react";
import Loading from "@control/loading";
import { useAudio } from "@hook/useaudio";
import { useVisit } from "@hook/usevisit";

const Visit = lazy(() => import("@default/visit")); 
const Dash = lazy(() => import("@default/dash"));

// path GateVisit: komponen penentu tampilan tutorial atau dashboard
const GateVisit: React.FC = () => {
  const { setIsTutorialActive } = useAudio();
  const { hasVisited, markComplete } = useVisit();

  // path effect: set isTutorialActive saat tutorial aktif
  useEffect(() => {
    if (!hasVisited) {
      setIsTutorialActive(true);
    }

    return () => {
      setIsTutorialActive(false);
    };
  }, [hasVisited, setIsTutorialActive]);

  const handleComplete = () => {
    markComplete();
    window.dispatchEvent(new Event("visitUpdated"));
    window.dispatchEvent(new Event("localVisitUpdate"));
    setIsTutorialActive(false);
  };

  return (
    <Suspense fallback={<Loading />}>
      {hasVisited ? (
        <Dash />
      ) : (
        <Visit onComplete={handleComplete} />
      )}
    </Suspense>
  );
};

export default GateVisit;