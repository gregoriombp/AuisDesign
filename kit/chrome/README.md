# AuisRewiew

Extensão Chrome MV3 de revisão pessoal, derivada do Review Bridge. Versão 0.2.0. Usa o motor de ancoragem/contexto de `@auis/core` e as primitivas e tokens de `@auis/ui`. Sem servidor local, Docker, agentes ou menções.

## Instalar

1. Na raiz do repositório: `npm run chrome:build`.
2. Em `chrome://extensions`, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
3. Selecione `kit/chrome/dist` (ou extraia `AuisRewiew.zip` e selecione a pasta extraída).
4. Fixe AuisRewiew na barra do Chrome. Abra um site e clique no ícone; `Alt+Shift+Y` também ativa/recolhe a barra.

Selecione elementos, coloque pins ou desenhe. Use Navegar para interagir com o site. A biblioteca mostra notas da página, do site ou de todos os sites, com busca, resolução, edição e exclusão confirmada. Fechar o Chrome preserva as notas neste perfil. Cada navegação completa exige reativar pelo ícone; navegações internas de SPA e hash são acompanhadas enquanto a ferramenta está ativa.

## Voz

O microfone pede autorização na própria aba revisada, ao clicar em Gravar comentário. A gravação usa o compositor compartilhado do Review Bridge e sua forma de onda, sem abrir outra aba. Grave até três minutos. O áudio é salvo **antes** do pedido de transcrição. Uma falha de conexão/login nunca descarta a gravação. O texto reconhecido é editável; salve para confirmar as alterações.

Serviço padrão: `https://novah.auis.design/api/review/transcribe`. Entre no Novah no mesmo perfil do Chrome. A requisição usa a sessão do navegador (`credentials: include`) e o mesmo contrato do Bridge (`POST multipart`, campo `audio`, retorno `{text}`). O servidor continua responsável pela chave OpenAI, autorização e limites. Se o servidor exigir proteção adicional, ajuste o serviço; não cole chaves OpenAI no código ou no pacote.

Configurações permitem autorizar outro endereço HTTPS que implemente esse contrato. Nenhuma chave OpenAI é armazenada ou distribuída pela extensão.

## Exportar e restaurar

- PDF: captura da página inteira, com áreas delimitadas e comentários sobre a imagem. A opção **Bolinhas clicáveis e comentários ao final** mantém os marcadores na captura e cria links internos até cada comentário, com um link de volta.
- PNG: página inteira com áreas delimitadas, desenhos, marcadores numerados e comentários sobre a imagem.
- Agrupamento: escolha **Todos sobre a mesma página** ou **Uma página inteira por comentário**. Múltiplas imagens são entregues em ZIP.
- Copiar para o Claude: Markdown com URL, pedido, contexto e referência dos anexos. O clipboard contém texto; envie também as imagens do pacote.
- Pacote completo: `review.md`, `review.json`, páginas inteiras anotadas, capturas de referência, imagens anexadas e áudios. A biblioteca importa ZIP/JSON e mescla por ID/data sem duplicar notas.

Dados ficam em IndexedDB **da extensão**, nunca no armazenamento do site. Não há sincronização entre computadores. Desinstalar a extensão remove os dados: exporte antes. A seleção guarda uma referência da área visível. Ao exportar pela barra, a extensão percorre a página inteira, captura os pixels reais, posiciona as marcações e restaura a rolagem original. A biblioteca reutiliza a última captura inteira; se não houver uma, pede que a página seja aberta e exportada pela barra. Elementos de modais/abas precisam estar presentes no estado capturado; caso contrário, a extensão informa quais marcações exigem reabrir esse estado, sem inventar posições. As notas antigas são preservadas na atualização.

## Limites

Páginas internas do Chrome e a loja de extensões não aceitam injeção. A captura cobre o documento e a principal região com rolagem interna; não expande simultaneamente vários painéis independentes. Páginas com mais de 30.000 pixels de altura, conteúdo infinito que continua crescendo e emulação de dispositivo com dimensões diferentes da captura do Chrome geram uma mensagem em vez de um arquivo apresentado como completo. Microfone requer HTTPS (ou localhost) e a política do site precisa permitir gravação. A seleção dentro de iframes de outra origem e de Shadow DOM fechado não é suportada nesta versão; use a região visível e a captura. Mudanças estruturais podem impedir a recuperação do alvo. PDF usa a fonte padrão do gerador; português e inglês são suportados, alfabetos fora de Latin-1 exigem uma fonte Unicode adicional.

## Desenvolvimento

`npm run chrome:build` gera a pasta instalável e o ZIP; `npm run typecheck` verifica tipos; `npm test` inclui os testes de domínio da extensão. `npm run chrome:test` verifica 20 cenários em um perfil descartável de Chromium (`npx playwright install chromium` na primeira vez), incluindo ativação real por activeTab, captura, desenho, modal, áudio, exportação, importação, reposicionamento, reinício, captura inteira, rolagem interna, permissão de microfone na mesma aba e links no PDF. O teste usa páginas sintéticas e não lê sessões do usuário.

Os arquivos de fontes em `assets/fonts` são Geist e Material Symbols Rounded, do Google Fonts, com suas licenças (SIL OFL e Apache 2.0). Os símbolos são um subconjunto dos ícones usados pela extensão. Os ícones de instalação são derivados do ícone existente de Auis (`app/icon.svg`).

## Atualizar uma instalação existente

Mantenha a mesma pasta carregada no Chrome. Gere o pacote, abra `chrome://extensions`, clique em **Recarregar** no AuisRewiew e atualize a página revisada. Não desinstale: recarregar preserva as notas locais.
