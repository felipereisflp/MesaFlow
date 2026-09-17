import { createFileRoute } from "@tanstack/react-router";
import { StaffHeader } from "@/components/StaffHeader";
import { StationBoard } from "@/components/StationBoard";

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — MesaFlow" },
      { name: "description", content: "Fila da cozinha em tempo real, por mesa e tempo de espera." },
      { property: "og:title", content: "Cozinha — MesaFlow" },
      {
        property: "og:description",
        content: "Fila da cozinha em tempo real, por mesa e tempo de espera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cozinha,
});

function Cozinha() {
  return (
    <>
      <StaffHeader />
      <StationBoard
        station="cozinha"
        title="Cozinha"
        subtitle="Itens da cozinha por etapa. Cartões em vermelho passaram de 15 minutos."
      />
    </>
  );
}
