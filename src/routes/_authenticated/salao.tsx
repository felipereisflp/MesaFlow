import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { StaffHeader } from "@/components/StaffHeader";
import { listFloor, transferTable, type FloorTable } from "@/lib/ops.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/salao")({
  head: () => ({
    meta: [
      { title: "Salão — MesaFlow" },
      { name: "description", content: "Mesas, contas abertas e transferência de mesa." },
      { property: "og:title", content: "Salão — MesaFlow" },
      { property: "og:description", content: "Mesas, contas abertas e transferência de mesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Salao,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  ORDERING: "Pedindo",
  PAYMENT_PENDING: "Aguardando pagamento",
  PARTIALLY_PAID: "Parcialmente paga",
};

function Salao() {
  const qc = useQueryClient();
  const fetchFloor = useServerFn(listFloor);
  const transfer = useServerFn(transferTable);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["floor"],
    queryFn: () => fetchFloor({ data: undefined }),
    refetchInterval: 8000,
  });

  const mutation = useMutation({
    mutationFn: (vars: { sessionId: string; toTableId: string }) => transfer({ data: vars }),
    onSuccess: () => {
      setTransferFrom(null);
      toast.success("Conta transferida.");
      qc.invalidateQueries({ queryKey: ["floor"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tables = (data ?? []) as FloorTable[];
  const freeTables = tables.filter((t) => !t.sessionId);
  const openCount = tables.filter((t) => t.sessionId).length;
  const totalOpen = tables.reduce((s, t) => s + (t.sessionId ? t.itemsTotal - t.paidTotal : 0), 0);

  return (
    <>
      <StaffHeader />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Salão</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {openCount} conta(s) aberta(s) · {brl(totalOpen)} em aberto
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando mesas…</p>
        ) : tables.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Cadastre mesas em "Mesas e QR" para acompanhar o salão.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((t) => (
              <Card
                key={t.tableId}
                className={`p-4 ${t.sessionId ? "border-primary/40" : "opacity-80"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">
                      Mesa {t.tableCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.area ? `${t.area} · ` : ""}
                      {t.seats} lugares
                    </p>
                  </div>
                  {t.sessionId ? (
                    <Badge>{STATUS_LABEL[t.status ?? ""] ?? t.status}</Badge>
                  ) : (
                    <Badge variant="secondary">Livre</Badge>
                  )}
                </div>

                {t.sessionId && (
                  <>
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-foreground">
                        Consumo: <strong>{brl(t.itemsTotal)}</strong>
                      </p>
                      <p className="text-muted-foreground">Pago: {brl(t.paidTotal)}</p>
                      <p className="text-muted-foreground">
                        {t.openItems} item(ns) em andamento
                        {t.readyItems > 0 ? ` · ${t.readyItems} pronto(s)` : ""}
                      </p>
                    </div>

                    {transferFrom === t.sessionId ? (
                      <div className="mt-3 space-y-2">
                        <Select
                          onValueChange={(toTableId) =>
                            mutation.mutate({ sessionId: t.sessionId!, toTableId })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha a mesa de destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {freeTables.map((f) => (
                              <SelectItem key={f.tableId} value={f.tableId}>
                                Mesa {f.tableCode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setTransferFrom(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        disabled={freeTables.length === 0}
                        onClick={() => setTransferFrom(t.sessionId)}
                      >
                        Transferir de mesa
                      </Button>
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
