// src/app/game/layout.tsx
'use client';
import React from "react";
import ClientLayout from "@/components/ClientLayout";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
