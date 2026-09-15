import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { listTables, saveTable, type VenueTable } from "@/lib/tables.functions";
import { createTag, revokeTag, rotateTag } from "@/lib/nfc.functions";
import { StaffHeader } from "@/components/StaffHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, QrCode, RefreshCw, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas e etiquetas NFC/QR — MesaFlow" },
      {
        name: "description",
        content:
          "Cadastre mesas, gere a etiqueta NFC/QR de cada uma e gire ou revogue o código quando precisar.",
      },
      { property: "og:title", content: "Mesas e etiquetas NFC/QR — MesaFlow" },
      {
        property: "og:description",
        content: "Códigos únicos por mesa, com rotação e revogação seguras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Mesas,
});

function Mesas() {
  const qc = useQueryClient();
  const fetchTables = useServerFn(listTables);
  const addTable = useServerFn(saveTable);
  const newTag = useServerFn(createTag);
  const rotate = useServerFn(rotateTag);
  const revoke = useServerFn(revokeTag);

  const tables = useQuery({ queryKey: ["tables"], queryFn: () => fetchTables({ data: undefined }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tables"] });

  const [code, setCode] = useState("");
  const [area, setArea] = useState("");
  const [seats, setSeats] = useState("4");
  const [qrFor, setQrFor] = useState<VenueTable | null>(null);

  const tableMut = useMutation({
    mutationFn: () =>
      addTable({ data: { displayCode: code, area: area || null, seats: Number(seats) || 4 } }),
    onSuccess: () => {
      toast.success("Mesa cadastrada.");
      setCode("");
      setArea("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tagMut = useMutation({
    mutationFn: (tableId: string) => newTag({ data: { tableId } }),
    onSuccess: () => {
      toast.success("Etiqueta gerada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: (tagId: string) =>
      rotate({ data: { tagId, reason: "Rotação manual pelo painel de mesas." } }),
    onSuccess: () => {
      toast.success("Novo código gerado. Reimprima a etiqueta.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (tagId: string) =>
      revoke({ data: { tagId, reason: "Revogação manual pelo painel de mesas." } }),
    onSuccess: () => {
      toast.success("Etiqueta revogada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Mesas e etiquetas</h1>
          <p className="text-sm text-muted-foreground">
            Cada mesa tem um código próprio e imprevisível. Girou o código, a etiqueta antiga para
            de funcionar na hora.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {tables.isLoading && <Skeleton className="h-40 w-full" />}
            {tables.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma mesa cadastrada ainda.</p>
            )}
            {tables.data?.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-base font-semibold text-foreground">
                      Mesa {t.displayCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.area || "Sem setor"} · {t.seats} lugares
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {t.tag ? (
                      <>
                        <Badge variant="secondary">Etiqueta v{t.tag.version}</Badge>
                        <Button variant="outline" size="sm" onClick={() => setQrFor(t)}>
                          <QrCode className="mr-2 h-4 w-4" /> Ver QR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotateMut.mutate(t.tag!.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" /> Girar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMut.mutate(t.tag!.id)}
                        >
                          <Ban className="mr-2 h-4 w-4 text-destructive" /> Revogar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => tagMut.mutate(t.id)}>
                        <QrCode className="mr-2 h-4 w-4" /> Gerar etiqueta
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="font-display text-base">Nova mesa</CardTitle>
              <CardDescription>O nome é só o rótulo que a equipe enxerga.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  tableMut.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="t-code">Nome / número</Label>
                  <Input
                    id="t-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-area">Setor</Label>
                  <Input
                    id="t-area"
                    placeholder="Salão, varanda…"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-seats">Lugares</Label>
                  <Input
                    id="t-seats"
                    type="number"
                    min={1}
                    max={40}
                    value={seats}
                    onChange={(e) => setSeats(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={tableMut.isPending}>
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar mesa
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <QrDialog table={qrFor} onClose={() => setQrFor(null)} />
    </div>
  );
}

function QrDialog({ table, onClose }: { table: VenueTable | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const link = table?.tag ? `${window.location.origin}/m/${table.tag.token}` : "";

  useEffect(() => {
    if (!link) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(link, { width: 520, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [link]);

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Mesa {table?.displayCode}</DialogTitle>
          <DialogDescription>
            Imprima e cole na mesa, ou grave este link na etiqueta NFC.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-center">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR da mesa ${table?.displayCode}`} className="mx-auto w-64" />
          ) : (
            <Skeleton className="mx-auto h-64 w-64" />
          )}
          <p className="break-all text-xs text-muted-foreground">{link}</p>
          <Button className="w-full" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
