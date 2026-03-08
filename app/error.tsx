"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-2xl font-semibold">Что-то пошло не так</h2>
      <p className="max-w-xl text-sm text-muted-foreground">Попробуйте перезагрузить страницу. Если ошибка повторяется, проверьте API и базу данных.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
