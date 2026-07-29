import { useEffect, useState } from "react";

export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Standard mount-detection flag used to defer client-only (e.g. localStorage-derived)
    // rendering until after hydration, avoiding SSR/client markup mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return mounted;
}
