import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Nfc, ChefHat, Wine, Receipt, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MesaFlow — Pedidos por NFC para bares e restaurantes" },
      {
        name: "description",
        content:
          "O cliente encosta o celular na mesa, pede pelo cardápio digital e cozinha, bar e caixa acompanham tudo em tempo real.",
      },
      { property: "og:title", content: "MesaFlow — Pedidos por NFC para bares e restaurantes" },
      {
        property: "og:description",
        content:
          "Cardápio por NFC/QR sem login, painéis de cozinha e bar em tempo real e caixa com fechamento auditado.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Nfc,
    title: "Pedido por aproximação",
    text: "Tag NFC ou QR na mesa abre o cardápio sem baixar nada e sem login.",
  },
  {
    icon: ChefHat,
    title: "Cozinha organizada",
    text: "Cada item vai para a estação certa, com fila por tempo de espera.",
  },
  {
    icon: Wine,
    title: "Bar em paralelo",
    text: "Bebidas seguem seu próprio andamento, sem travar a comida.",
  },
  {
    icon: Receipt,
    title: "Caixa sem fila",
    text: "Conta sempre atualizada, divisão de conta e pagamentos parciais.",
  },
  {
    icon: ShieldCheck,
    title: "Tudo registrado",
    text: "Quem fez o quê, quando e por quê, com histórico encadeado.",
  },
  {
    icon: Zap,
    title: "Tempo real",
    text: "Salão, cozinha e caixa enxergam a mesma mesa no mesmo instante.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold tracking-tight text-foreground">
          Mesa<span className="text-primary">Flow</span>
        </span>
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Nfc className="h-3.5 w-3.5 text-primary" /> Encostou, pediu, chegou
            </span>
            <h1 className="font-display mt-6 text-4xl leading-tight font-bold text-balance text-foreground sm:text-6xl">
              O cardápio da sua mesa a um toque de celular
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Seu cliente aproxima o telefone da tag na mesa e pede sozinho. Cozinha, bar e caixa
              recebem tudo separado e em tempo real.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Criar meu estabelecimento</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="transition-shadow hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="bg-accent text-accent-foreground flex h-10 w-10 items-center justify-center rounded-lg">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-display mt-4 text-base font-semibold text-foreground">
                    {f.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        MesaFlow — pedidos por NFC para bares e restaurantes.
      </footer>
    </div>
  );
}
