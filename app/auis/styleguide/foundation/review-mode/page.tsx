import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../_primitives"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-(--bg-muted) border border-(--border-subtle) text-(--fg-primary) text-[11px] mx-0.5">
      {children}
    </kbd>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 h-7 w-7 rounded-full bg-(--bg-inverse) text-(--fg-on-inverse) text-xs font-semibold inline-flex items-center justify-center">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="m-0 text-base font-semibold text-(--fg-primary)">
          {title}
        </h3>
        <p className="mt-1 mb-0 text-sm text-(--fg-secondary) leading-relaxed">
          {children}
        </p>
      </div>
    </li>
  )
}

export default function ReviewModeFoundationPage() {
  return (
    <div className="flex flex-col gap-12">
      <PageHero title="Review Mode">
        Ferramenta interna do Auis pra anotar telas durante reviews ao
        vivo. Marcação livre e pinos com comentário, salvos no navegador ou
        num bridge local para um agente resolver e devolver para aprovação.
      </PageHero>

      <Section
        id="ativar"
        title="Como ativar"
        lead="O Review Mode fica sempre montado — sem env flag. Ele se auto-gateia pelo estado do store, então é só abrir."
      >
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Icon
              name="draw"
              size={20}
              className="text-(--fg-tertiary) mt-0.5"
            />
            <p className="m-0 text-sm text-(--fg-secondary)">
              Abra a <strong>bolota do Auis</strong> (canto inferior) e
              escolha <strong>Entrar no Review Mode</strong> — ou aperte{" "}
              <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Y</Kbd>. Sem env flag, sem rebuild.
            </p>
          </div>
          <p className="m-0 text-sm text-(--fg-secondary)">
            No fluxo normal, <code className="font-mono text-xs">npm run dev</code>{" "}
            prepara o token, sobe o bridge local e aponta o frontend para{" "}
            <code className="font-mono text-xs">127.0.0.1:9878</code>. Sem bridge,
            os comentários ficam no <code className="font-mono text-xs">localStorage</code> do browser.
          </p>
        </div>
      </Section>

      <Section
        id="usar"
        title="Como usar"
        lead="Marcação livre pra circular regiões; pino pra pontuar um local exato."
      >
        <ol className="list-none p-0 m-0 flex flex-col gap-5">
          <Step number={1} title="Identifique-se">
            Na primeira ativação, escolha um nome e uma cor. Tudo fica salvo
            no seu navegador e aparece nos comentários e nas aprovações.
          </Step>
          <Step number={2} title="Escolha o modo">
            Na barra inferior: <Kbd>cursor</Kbd> não captura,{" "}
            <Kbd>marcação livre</Kbd> deixa você desenhar com o mouse,{" "}
            <Kbd>pino</Kbd> cola um marcador num clique. <Kbd>⌘</Kbd>+
            <Kbd>⇧</Kbd>+<Kbd>K</Kbd> alterna entre os modos.
          </Step>
          <Step number={3} title="Anote">
            Solte o mouse (ou clique no pino) e o popover aparece. Escreva o
            feedback e <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> pra salvar. <Kbd>Esc</Kbd>{" "}
            cancela.
          </Step>
          <Step number={4} title="Revise no painel lateral">
            O ícone <Icon name="forum" size={14} /> abre a lista. Filtre por
            abertos / em revisão / arquivados, pula entre telas, aprova ou
            rejeita entregas de agente e deleta comentários. Click num cartão
            dá scroll suave até o anchor na própria tela.
          </Step>
          <Step number={5} title="Exporte">
            <Icon name="ios_share" size={14} /> abre um modal com o JSON
            completo. Útil pra arquivar uma sessão de review ou inspecionar o
            payload que o agente está recebendo.
          </Step>
        </ol>
      </Section>

      <Section
        id="bridge"
        title="Bridge local (fila para agente)"
        lead="O bridge roda na própria máquina, em 127.0.0.1, e persiste a fila que os agentes locais leem para resolver comentários. Não é um servidor para outras pessoas da rede."
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AuPill variant="ai" dot={false}>
                Servidor
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                review-bridge/
              </span>
            </div>
            <ol className="list-decimal pl-5 m-0 text-sm text-(--fg-secondary) space-y-1.5 leading-relaxed">
              <li>
                <code className="font-mono text-xs">npm install</code>{" "}
                instala as deps da raiz. Se o bridge estiver sem deps, rode{" "}
                <code className="font-mono text-xs">npm run review-bridge:install</code>.
              </li>
              <li>
                <code className="font-mono text-xs">npm run dev</code> executa{" "}
                <code className="font-mono text-xs">review-bridge:prepare</code>,
                gera ou reaproveita o token e sobe o bridge em{" "}
                <code className="font-mono text-xs">127.0.0.1:9878</code>.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AuPill variant="beta" dot={false}>
                Frontend
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                .env.local
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary)">
              O prepare do <code className="font-mono text-xs">npm run dev</code>{" "}
              mantém as duas vars abaixo em <code className="font-mono text-xs">.env.local</code>.
              Com elas, o overlay usa o bridge no lugar do localStorage.
            </p>
            <pre className="m-0 rounded-sm bg-(--bg-muted) border border-(--border-subtle) p-3 text-[12px] font-mono whitespace-pre-wrap">
              {`NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL=http://127.0.0.1:9878
NEXT_PUBLIC_AUIS_REVIEW_TOKEN=<mesmo-token-do-servidor>`}
            </pre>
            <p className="m-0 text-xs text-(--fg-tertiary) flex items-start gap-1.5">
              <Icon name="info" size={13} className="mt-0.5" />
              <span>
                Se você já tinha comentários no localStorage, o overlay
                detecta na primeira abertura e oferece um toast{" "}
                <strong>Importar</strong> pra subir tudo pro bridge.
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AuPill variant="error" dot={false}>
                Segurança
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Local-only, não exponha pra rede
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Auth é um token em header (
              <code className="font-mono text-xs">X-Review-Token</code>). É
              suficiente para o fluxo local de desenvolvimento, mas não é um
              modelo de produto público. O servidor deve escutar em{" "}
              <code className="font-mono text-xs">127.0.0.1</code>; não use{" "}
              <code className="font-mono text-xs">0.0.0.0</code>, não faça port
              forwarding e não coloque dados sensíveis nesses comentários.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="atalhos"
        title="Atalhos"
        lead="Tudo pelo teclado pra não atrapalhar a navegação no produto."
      >
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) overflow-hidden">
          <ul className="divide-y divide-(--border-subtle) m-0 p-0 list-none">
            {[
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Y</Kbd>
                  </>
                ),
                desc: "Liga/desliga o overlay",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>K</Kbd>
                  </>
                ),
                desc: "Alterna cursor → marcação → pino",
              },
              {
                keys: (
                  <>
                    <Kbd>⌘</Kbd>+<Kbd>↵</Kbd>
                  </>
                ),
                desc: "Salva o comentário no popover aberto",
              },
              {
                keys: <Kbd>Esc</Kbd>,
                desc: "Cancela o popover; volta pra cursor; fecha o painel",
              },
            ].map((row, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm text-(--fg-secondary)">
                  {row.desc}
                </span>
                <span className="flex items-center text-[11px]">
                  {row.keys}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="limitacoes"
        title="Limitações conhecidas"
        lead="A v1 prioriza simplicidade — alguns trade-offs documentados pra você decidir quando confiar nela."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="draft" dot={false}>
                Stale
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Anchor pode dessincar
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Coords são salvas em % do viewport + scrollY. Se o conteúdo
              da tela mudou (lista cresceu, dado novo carregou), o anchor
              pode ficar fora do lugar. Marcamos como <strong>stale</strong>{" "}
              quando a altura do documento mudou +20%.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Bridge local
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Fila para agente local
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Sem bridge configurado, tudo fica no localStorage do navegador.
              Com bridge, os comentários vão para arquivos JSON locais e podem
              ser consumidos por agentes na mesma máquina. Outras máquinas não
              são suportadas nesse modo.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Identidade local
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Identidade é só nome
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Você digita o nome uma vez. Não há login real; a identidade serve
              para autoria dos comentários e para aprovar ou rejeitar entregas
              de agente.
            </p>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-5">
            <div className="flex items-center gap-2 mb-2">
              <AuPill variant="neutral" dot={false}>
                Coexistência
              </AuPill>
              <span className="text-xs text-(--fg-tertiary)">
                Convive com Claude Edit
              </span>
            </div>
            <p className="m-0 text-sm text-(--fg-secondary) leading-relaxed">
              Todas as camadas do Review carregam{" "}
              <code className="font-mono text-xs">
                data-auis-review
              </code>{" "}
              pra que o picker do Claude Edit (<Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+
              <Kbd>L</Kbd>) ignore o canvas, e vice-versa.
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
