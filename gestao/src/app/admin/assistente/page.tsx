import { redirect } from "next/navigation";

// O assistente virou um botão flutuante disponível em todas as telas.
// Esta rota antiga agora só redireciona para o painel inicial.
export default function AssistentePage() {
  redirect("/admin");
}
