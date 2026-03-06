"use client";

import { useSearchParams } from "next/navigation";

export default function LoginContent() {
  const searchParams = useSearchParams();

  return (
    <div>
      Login page
    </div>
  );
}