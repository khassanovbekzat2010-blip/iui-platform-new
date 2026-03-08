"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { useAppStore } from "@/store/app-store";

type ShopDTO = {
  hero: { coins: number; gems: number } | null;
  items: Array<{ id: string; name: string; slug: string; rarity: string; type: string; priceCoins: number; priceGems: number }>;
  inventory: Array<{ id: string; quantity: number; itemDefinition: { name: string } }>;
};

export default function ShopPage() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const userId = getJourneyUserId(user);

  const query = useQuery({
    queryKey: ["shop", userId],
    enabled: Boolean(userId),
    queryFn: () => apiRequest<ShopDTO>(`/api/shop/catalog?userId=${encodeURIComponent(userId)}`)
  });

  const purchaseMutation = useMutation({
    mutationFn: (itemSlug: string) =>
      apiRequest("/api/shop/purchase", {
        method: "POST",
        body: JSON.stringify({ userId, itemSlug, quantity: 1 })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop", userId] });
      pushToast("Покупка успешна", "Предмет добавлен в инвентарь");
    },
    onError: (error) => {
      pushToast("Ошибка", error instanceof Error ? error.message : "Не удалось купить предмет");
    }
  });

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">Магазин временно недоступен.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Shop & Inventory</h2>
        <p className="text-muted-foreground">Косметика, бустеры и utility предметы за Coins/Gems.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Wallet: {query.data.hero?.coins ?? 0} Coins / {query.data.hero?.gems ?? 0} Gems
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {query.data.items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{item.rarity} • {item.type}</p>
              <p>
                Price: {item.priceCoins} Coins / {item.priceGems} Gems
              </p>
              <Button data-testid={`buy-${item.slug}`} size="sm" onClick={() => purchaseMutation.mutate(item.slug)}>
                Купить
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
