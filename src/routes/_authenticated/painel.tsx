import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/me.functions";
import {
  addTeamMember,
  createTenant,
  listTeam,
  removeTeamMember,
  setMemberRole,
} from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LogOut, UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do estabelecimento — MesaFlow" },
      {
        name: "description",
        content: "Configure seu estabelecimento e gerencie os acessos da equipe no MesaFlow.",
      },
      { property: "og:title", content: "Painel do estabelecimento — MesaFlow" },
      {
        property: "og:description",
        content: "Estabelecimento, perfis e permissões da equipe em um só lugar.",
      },
    ],
  }),
  component: Painel,
});

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "caixa", label: "Caixa" },
  { value: "garcom", label: "Garçom" },
  { value: "cozinha", label: "Cozinha" },
  { value: "bar", label: "Bar" },
  { value: "auditor", label: "Auditor" },
] as const;

type Role = (typeof ROLES)[number]["value"] | "owner";

function Painel() {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMyContext);

  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe({ data: undefined }) });

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {me.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : me.data?.tenant ? (
          <>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {me.data.tenant.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Olá, {me.data.fullName || "equipe"} — taxa de serviço{" "}
                {me.data.tenant.service_fee_pct}%.
              </p>
            </div>
            <Equipe canManage={me.data.roles.some((r) => r === "owner" || r === "admin")} />
          </>
        ) : (
          <Onboarding onDone={() => qc.invalidateQueries({ queryKey: ["me"] })} />
        )}
      </main>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createTenant);
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [fee, setFee] = useState("10");

  const mutation = useMutation({
    mutationFn: () =>
      create({ data: { name, fullName, serviceFeePct: Number(fee) || 0 } }),
    onSuccess: () => {
      toast.success("Estabelecimento criado.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="font-display">Vamos criar seu estabelecimento</CardTitle>
        <CardDescription>Dá para ajustar tudo isso depois.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="nome-estab">Nome do estabelecimento</Label>
            <Input
              id="nome-estab"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seu-nome">Seu nome</Label>
            <Input
              id="seu-nome"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxa">Taxa de serviço (%)</Label>
            <Input
              id="taxa"
              type="number"
              min={0}
              max={30}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Criar estabelecimento
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Equipe({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const add = useServerFn(addTeamMember);
  const setRole = useServerFn(setMemberRole);
  const remove = useServerFn(removeTeamMember);

  const team = useQuery({ queryKey: ["team"], queryFn: () => fetchTeam({ data: undefined }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["team"] });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole0] = useState<Role>("garcom");

  const addMut = useMutation({
    mutationFn: () => add({ data: { email, fullName, password, role: role as never } }),
    onSuccess: () => {
      toast.success("Membro adicionado.");
      setEmail("");
      setFullName("");
      setPassword("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: string }) => setRole({ data: v as never }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      toast.success("Membro removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Equipe</CardTitle>
          <CardDescription>Quem pode acessar cada área da operação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.isLoading && <Skeleton className="h-20 w-full" />}
          {team.data?.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{m.fullName}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.roles.includes("owner") ? (
                  <Badge>Dono</Badge>
                ) : canManage ? (
                  <>
                    <Select
                      value={m.roles[0] ?? "garcom"}
                      onValueChange={(v) => roleMut.mutate({ userId: m.id, role: v })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMut.mutate(m.id)}
                      aria-label={`Remover ${m.fullName}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary">{m.roles[0] ?? "sem perfil"}</Badge>
                )}
              </div>
            </div>
          ))}
          {team.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Ninguém cadastrado ainda.</p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-display text-base">Adicionar membro</CardTitle>
            <CardDescription>Ele entra com o e-mail e a senha definidos aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                addMut.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="m-nome">Nome</Label>
                <Input
                  id="m-nome"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-email">E-mail</Label>
                <Input
                  id="m-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-senha">Senha inicial</Label>
                <Input
                  id="m-senha"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={role} onValueChange={(v) => setRole0(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={addMut.isPending}>
                <UserPlus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
