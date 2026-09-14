import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMenu, saveCategory, saveProduct, setProductState } from "@/lib/menu.functions";
import { StaffHeader } from "@/components/StaffHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio digital — MesaFlow" },
      {
        name: "description",
        content:
          "Monte categorias e produtos do seu cardápio, defina preço, estação e disponibilidade.",
      },
      { property: "og:title", content: "Cardápio digital — MesaFlow" },
      {
        property: "og:description",
        content: "Categorias, produtos, preços e disponibilidade em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cardapio,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Cardapio() {
  const qc = useQueryClient();
  const fetchMenu = useServerFn(listMenu);
  const addCategory = useServerFn(saveCategory);
  const addProduct = useServerFn(saveProduct);
  const changeState = useServerFn(setProductState);

  const menu = useQuery({ queryKey: ["menu"], queryFn: () => fetchMenu({ data: undefined }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["menu"] });

  const [catName, setCatName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [station, setStation] = useState<"cozinha" | "bar">("cozinha");
  const [categoryId, setCategoryId] = useState<string>("");

  const catMut = useMutation({
    mutationFn: () => addCategory({ data: { name: catName } }),
    onSuccess: () => {
      toast.success("Categoria criada.");
      setCatName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prodMut = useMutation({
    mutationFn: () =>
      addProduct({
        data: {
          name,
          description: description || null,
          price: Number(price.replace(",", ".")) || 0,
          station,
          categoryId: categoryId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Produto adicionado.");
      setName("");
      setDescription("");
      setPrice("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stateMut = useMutation({
    mutationFn: (v: { id: string; available?: boolean; archived?: boolean }) =>
      changeState({ data: v }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const cats = menu.data?.categories ?? [];
    const prods = (menu.data?.products ?? []).filter((p) => !p.archived);
    return [
      ...cats.map((c) => ({ id: c.id, name: c.name, items: prods.filter((p) => p.categoryId === c.id) })),
      { id: "sem", name: "Sem categoria", items: prods.filter((p) => !p.categoryId) },
    ].filter((g) => g.items.length > 0 || g.id !== "sem");
  }, [menu.data]);

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cardápio</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que o cliente vê ao encostar o celular na mesa.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {menu.isLoading && <Skeleton className="h-48 w-full" />}
            {grouped.map((g) => (
              <Card key={g.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base">{g.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p>
                  )}
                  {g.items.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-40">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.description || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">
                          {p.station === "bar" ? "Bar" : "Cozinha"}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {brl(p.price)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={p.available}
                            onCheckedChange={(v) =>
                              stateMut.mutate({ id: p.id, available: v })
                            }
                            aria-label={`Disponibilidade de ${p.name}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {p.available ? "No ar" : "Pausado"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Arquivar ${p.name}`}
                          onClick={() => stateMut.mutate({ id: p.id, archived: true })}
                        >
                          <Archive className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="font-display text-base">Nova categoria</CardTitle>
                <CardDescription>Ex.: Entradas, Drinks, Sobremesas.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    catMut.mutate();
                  }}
                >
                  <Input
                    required
                    value={catName}
                    placeholder="Nome da categoria"
                    onChange={(e) => setCatName(e.target.value)}
                  />
                  <Button type="submit" size="icon" disabled={catMut.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="font-display text-base">Novo produto</CardTitle>
                <CardDescription>Escolha se sai da cozinha ou do bar.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    prodMut.mutate();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="p-nome">Nome</Label>
                    <Input
                      id="p-nome"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-desc">Descrição</Label>
                    <Textarea
                      id="p-desc"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-preco">Preço (R$)</Label>
                    <Input
                      id="p-preco"
                      required
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {(menu.data?.categories ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sai de</Label>
                    <Select
                      value={station}
                      onValueChange={(v) => setStation(v as "cozinha" | "bar")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cozinha">Cozinha</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={prodMut.isPending}>
                    Adicionar produto
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
