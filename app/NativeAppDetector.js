"use client";
import { useEffect } from "react";

export default function NativeAppDetector() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
      document.body.classList.add("native-app");
    }
  }, []);

  return null;
}
