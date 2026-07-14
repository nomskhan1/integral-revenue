import { Suspense } from "react";
import SquareRedirectContent from "./content";

export default function SquareRedirectPage() {
  return (
    <Suspense fallback={<div style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}>Loading...</div>}>
      <SquareRedirectContent />
    </Suspense>
  );
}
