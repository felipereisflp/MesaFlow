import { createFileRoute } from "@tanstack/react-router";
import { StaffHeader } from "@/components/StaffHeader";
import { StationBoard } from "@/components/StationBoard";

export const Route = createFileRoute("/_authenticated/bar")({
  head: () => ({
    meta: [
      { title: "Bar — MesaFlow" },
      { name: "description", content: "Fila do bar em tempo real, por mesa e tempo de espera." },
      { property: "og:title", content: "Bar — MesaFlow" },
      {
        property: "og:description",
        content: "Fila do bar em tempo real, por mesa e tempo de espera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bar,
});

function Bar() {
  return (
    <>
      <StaffHeader />
      <StationBoard
        station="bar"
        title="Bar"
        subtitle="Bebidas por etapa. Cartões em vermelho passaram de 15 minutos."
      />
    </>
  );
}
