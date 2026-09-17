import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { advanceItem, listStationQueue, type StationItem } from "@/lib/ops.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const LABEL: Record<string, string> = {
  SUBMITTED: "Recebido",
  CONFIRMED: "Recebido",
  IN_PREPARATION: "Em preparo",
  READY: "Pronto",
};

const ACTION: Record<string, string> = {
  SUBMITTED: "Iniciar preparo",
  CONFIRMED: "Iniciar preparo",
  IN_PREPARATION: "Marcar pronto",
  READY: "Marcar entregue",
};

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function StationBoard({
  station,
  title,
  subtitle,
}: {
  station: "cozinha" | "bar";
  title: string;
  subtitle: string;
}) {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(listStationQueue);
  const advance = useServerFn(advanceItem);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["station", station],
    queryFn: () => fetchQueue({ data: { station } }),
    refetchInterval: 8000,
  });

  const mutation = useMutation({
    mutationFn: (itemId: string) => advance({ data: { itemId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["station", station] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const items = (data ?? []) as StationItem[];
  const groups: Record<string, StationItem[]> = {
    SUBMITTED: items.filter((i) => i.status === "SUBMITTED" || i.status === "CONFIRMED"),
    IN_PREPARATION: items.filter((i) => i.status === "IN_PREPARATION"),
    READY: items.filter((i) => i.status === "READY"),
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando fila…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhum item na fila agora.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(["SUBMITTED", "IN_PREPARATION", "READY"] as const).map((col) => (
            <section key={col} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {LABEL[col]}
                <Badge variant="secondary">{groups[col]!.length}</Badge>
              </h2>
              {groups[col]!.map((item) => {
                const mins = minutesSince(item.createdAt);
                const late = mins >= 15 && col !== "READY";
                return (
                  <Card
                    key={item.id}
                    className={`p-4 ${late ? "border-destructive/60 bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {item.quantity}× {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">Mesa {item.tableCode}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${late ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {mins} min
                      </span>
                    </div>
                    {(item.note || item.orderNote) && (
                      <p className="mt-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {[item.note, item.orderNote].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate(item.id)}
                    >
                      {ACTION[item.status]}
                    </Button>
                  </Card>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
