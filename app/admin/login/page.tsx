"use client";

import { Suspense } from "react";
import LoginContent from "./login-content";

export default function Page() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <LoginContent />
    </Suspense>
  );
}