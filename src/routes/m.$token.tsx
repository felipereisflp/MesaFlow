import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTabState,
  openTableSession,
  submitCustomerOrder,
  type PublicBootstrap,
} from "@/lib/public.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/m/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cardápio da mesa — MesaFlow" },
      {
        name: "description",
        content: "Veja o cardápio, peça pela mesa e acompanhe sua conta em tempo real.",
      },
      { property: "og:title", content: "Cardápio da mesa — MesaFlow" },
      {
        property: "og:description",
        content: "Peça direto do celular, sem app e sem login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Vitrine,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Vitrine() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const open = useServerFn(openTableSession);
  const fetchTab = useServerFn(getTabState);
  const sendOrder = useServerFn(submitCustomerOrder);

  const [boot, setBoot] = useState<PublicBootstrap | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    open({ data: { token } })
      .then((b) => alive && setBoot(b))
      .catch((e: Error) => alive && setErro(e.message));
    return () => {
      alive = false;
    };
  }, [open, token]);

  const sessionToken = boot?.sessionToken;

  const tab = useQuery({
    queryKey: ["tab", sessionToken],
    enabled: !!sessionToken,
    refetchInterval: 8000,
    queryFn: () => fetchTab({ data: { sessionToken: sessionToken! } }),
  });

  const enviar = useMutation({
    mutationFn: () =>
      sendOrder({
        data: {
          sessionToken: sessionToken!,
          idempotencyKey: crypto.randomUUID(),
          note: note || undefined,
          items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
        },
      }),
    onSuccess: () => {
      setCart({});
      setNote("");
      toast.success("Pedido enviado para a cozinha e o bar!");
      qc.invalidateQueries({ queryKey: ["tab", sessionToken] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cartTotal = useMemo(() => {
    if (!boot) return 0;
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = boot.products.find((x) => x.id === id);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [cart, boot]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  if (erro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="max-w-sm">
          <CardContent className="space-y-2 p-6 text-center">
            <h1 className="font-display text-xl font-bold text-foreground">Não deu certo</h1>
            <p className="text-sm text-muted-foreground">{erro}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!boot) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  const semCategoria = boot.products.filter((p) => !p.categoryId);
  const conta = tab.data;
  const aPagar = conta
    ? conta.itemsTotal + conta.serviceFee - conta.discountTotal - conta.paidTotal
    : 0;

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="font-display text-xl font-bold text-foreground">{boot.tenant.name}</h1>
        <p className="text-sm text-muted-foreground">Mesa {boot.table.displayCode}</p>
      </header>

      <main className="mx-auto max-w-lg space-y-8 px-5 py-6">
        {boot.categories.map((cat) => {
          const items = boot.products.filter((p) => p.categoryId === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-foreground">{cat.name}</h2>
              {items.map((p) => (
                <ProductRow
                  key={p.id}
                  name={p.name}
                  description={p.description}
                  price={p.price}
                  qty={cart[p.id] ?? 0}
                  onChange={(q) =>
                    setCart((c) => {
                      const next = { ...c };
                      if (q <= 0) delete next[p.id];
                      else next[p.id] = q;
                      return next;
                    })
                  }
                />
              ))}
            </section>
          );
        })}

        {semCategoria.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Outros</h2>
            {semCategoria.map((p) => (
              <ProductRow
                key={p.id}
                name={p.name}
                description={p.description}
                price={p.price}
                qty={cart[p.id] ?? 0}
                onChange={(q) =>
                  setCart((c) => {
                    const next = { ...c };
                    if (q <= 0) delete next[p.id];
                    else next[p.id] = q;
                    return next;
                  })
                }
              />
            ))}
          </section>
        )}

        {boot.products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            O cardápio ainda não foi publicado. Chame um atendente.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Sua conta</h2>
          {conta && conta.items.length > 0 ? (
            <Card>
              <CardContent className="space-y-2 p-4 text-sm">
                {conta.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3">
                    <span className="text-foreground">
                      {i.quantity}× {i.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">{statusLabel(i.status)}</Badge>
                      <span className="text-muted-foreground">
                        {brl(i.unitPrice * i.quantity)}
                      </span>
                    </span>
                  </div>
                ))}
                <div className="mt-2 border-t border-border pt-2 text-right font-semibold text-foreground">
                  Total a pagar: {brl(aPagar)}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          )}
        </section>
      </main>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-lg space-y-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observação para a cozinha (opcional)"
              rows={2}
            />
            <Button
              className="w-full"
              size="lg"
              disabled={enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              Enviar pedido · {cartCount} {cartCount === 1 ? "item" : "itens"} · {brl(cartTotal)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: "Recebido",
    CONFIRMED: "Confirmado",
    IN_PREPARATION: "Em preparo",
    READY: "Pronto",
    DELIVERED: "Entregue",
  };
  return map[status] ?? status;
}

function ProductRow({
  name,
  description,
  price,
  qty,
  onChange,
}: {
  name: string;
  description: string | null;
  price: number;
  qty: number;
  onChange: (q: number) => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{name}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <p className="mt-1 text-sm font-semibold text-primary">{brl(price)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Remover ${name}`}
            disabled={qty === 0}
            onClick={() => onChange(qty - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-5 text-center text-sm font-medium text-foreground">{qty}</span>
          <Button
            variant="default"
            size="icon"
            aria-label={`Adicionar ${name}`}
            onClick={() => onChange(qty + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
