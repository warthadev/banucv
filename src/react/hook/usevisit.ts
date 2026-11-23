// src/react/hook/usevisit.ts
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../redux/store";
import { setHasVisited, completeVisit } from "../redux/visitslice";
import { useEffect } from "react";

// path useVisit: custom hook untuk status kunjungan tutorial pertama kali
export const useVisit = () => {
  const dispatch = useDispatch();
  const hasVisited = useSelector((state: RootState) => state.visit.hasVisited);

  // path effect sync dari localStorage ke Redux (untuk perubahan dari tab lain)
  useEffect(() => {
    const syncVisit = () => {
      const stored = localStorage.getItem("hasVisitedBefore") === "true";
      if (stored !== hasVisited) {
        dispatch(setHasVisited(stored));
      }
    };
    
    window.addEventListener("storage", syncVisit);
    window.addEventListener("localVisitUpdate", syncVisit);
    
    return () => {
      window.removeEventListener("storage", syncVisit);
      window.removeEventListener("localVisitUpdate", syncVisit);
    };
  }, [dispatch, hasVisited]);

  const markComplete = () => {
    dispatch(completeVisit());
  };

  return { hasVisited, markComplete };
};