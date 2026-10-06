# Diário Técnico — Pirate Battle

> Caderno pessoal de estudo, fora da documentação oficial do produto. Registro o estado encontrado em 06/10/2026. A autoria das implementações preexistentes não está registrada nos arquivos; não vou atribuí-las a Manual, Codex, Trae ou trabalho colaborativo sem evidência. Esta primeira versão do diário foi escrita com auxílio do Codex.

## 1. Visão geral do projeto

**Atualização da etapa 24:** conclusões agora entram em uma coleção local de pendências antes do POST. Falhas sobrevivem ao refresh e permitem retry explícito no Result/menu, com várias partidas independentes. Confirmação remove a pendência; reenvio recupera o mesmo registro pelo matchId. Cenários configuráveis completos e sincronização entre abas seguem futuros.

**Estado atual após a etapa 23:** conclusões aceitas pelo MSW agora persistem após refresh em uma coleção versionada, compartilhada por ranking/histórico. Reenvios iguais recuperam o registro; IDs conflitantes recebem 409. Pendências e retries continuam futuros. As etapas anteriores preservam os limites que existiam quando foram implementadas.

Pirate Battle é uma aplicação web que pretende ser um jogo 2D de combate naval visto de cima. A base usa React 19, TypeScript em modo estrito e PixiJS 8 para a parte gráfica. Vite serve e empacota a aplicação. TanStack Query, Axios e MSW formam a base da comunicação HTTP simulada; Playwright está configurado para testes E2E.

A arquitetura planejada separa a interface e navegação React da simulação e renderização contínuas do jogo. O React deve cuidar de telas, menus e dados remotos; PixiJS deve desenhar a arena e o código de jogo deve atualizar o estado em um loop próprio, sem re-renderizar o React a cada frame.

Já existem telas de menu, opções, jogo, resultado, ranking e histórico; navegação local entre elas; endpoints e respostas simuladas para ranking, histórico e envio de partida; e um teste E2E básico. `GameCanvas` inicializa e destrói uma aplicação PixiJS, e `GameLoop` tem uma estrutura de timestep fixo.

A fatia jogável mostra água oficial, ilha e navio controlado por W/↑, A/← e D/→. Space dispara pela proa; Q/E lançam três balas paralelas. Chaser e Shooter surgem periodicamente com seed e posições validadas. A partida usa countdown da simulação, padrão 120 s; ao expirar, congela o gameplay e mantém a arena visível. Pontuação autoritativa soma 1 por inimigo eliminado por projétil do jogador; autodestruição não pontua. HP zero encerra por defeated e congela o gameplay. HUD React usa painéis/ícones oficiais e lista semântica para pontos, HP, tempo MM:SS e status reais por snapshots; comandos aparecem em legenda com teclas identificadas; Pixi mostra barras oficiais acima de todos os navios. Pausa manual e automática por blur/aba oculta congela a simulação e exige Resume explícito. Options salva duração 60–180 s e intervalo de spawn 1–15 s localmente; novas partidas usam valores salvos. Término normal navega para Result com dados reais e persiste a última conclusão; abandono retorna ao menu sem substituir resultado. Conclusões agora são enviadas por mutation/Axios ao MSW e aparecem no histórico confirmado da sessão. Sons, ranking completo e robustez/persistência da API continuam pendentes.

## 2. Como a arquitetura funciona

**Pendências:** `pendingMatchesStorage` mantém os payloads locais aguardando confirmação; `useSyncExternalStore` publica somente alterações da coleção/erro de armazenamento para as telas. `useSubmitMatch` continua sendo o caminho único de mutation → Axios → MSW, tanto na conclusão quanto no retry. Registro confirmado permanece na coleção do servidor simulado; a lista local de pendências não alimenta ranking/histórico diretamente.

**Persistência dos confirmados:** `confirmedMatchesStorage` lê/valida um único dataset; `matchHistoryState` hidrata seu Map quando o módulo é carregado. O POST salva antes de confirmar e as duas consultas derivam desse mesmo Map combinado com fixtures. React continua acessando apenas hooks/API; não lê essa coleção diretamente. Resultado local e Options continuam em chaves separadas, pois representam responsabilidades diferentes.

**Atualização da etapa 19:** ranking básico agora está funcional e paginado, compartilhando fixtures e confirmados com histórico. A descrição anterior de ranking pendente refere-se ao estado antes desta etapa; robustez e persistência remota ainda estão pendentes. GET ranking compara o snapshot completo e MSW funciona também no build.

- **React:** monta o aplicativo e apresenta telas, navegação e controles de interface. Em `App`, a tela atual é escolhida por estado local. React guarda loading e um snapshot de apresentação do HUD, sem receber coordenadas contínuas ou mapas da partida.
- **PixiJS:** `GameCanvas` inicializa uma `Application` com coordenadas lógicas 960 × 600 e resolução do dispositivo; o canvas é escalado via CSS mantendo proporção. O ticker automático do Pixi fica desligado para usar o loop do jogo.
- **Game:** valida duração 60–180 s, copia config e cria estado/SpawnSystem novos. Atualiza countdown e coordena sistemas somente com status running; paused para loop/input e resume reinicia o relógio. Ao terminar, remove input e mantém renderização do estado congelado.
- **GameLoop:** usa `requestAnimationFrame`, acumula tempo e chama `update` em passos fixos de 1/60 s; limita delta longo a 250 ms. Chama render em cada frame e calcula `alpha`, ainda não usado para interpolação.
- **GameState:** guarda entidades, score, cooldowns, IDs, duração, remainingSeconds, elapsedSeconds, status running/paused/finished e finishReason. Esses dados são autoritativos; nenhum objeto Pixi fica no estado. O antigo boolean isRunning foi substituído pelo status.
- **GameRenderer:** repete água, compõe ilhas e desenha jogador, Chaser, Shooter e balas de ambas as equipes. Mapas por ID reutilizam sprites e destroem os removidos. Desenha barras de vida oficiais acima dos navios, sem girá-las. Não calcula IA, colisão nem dano. Debug opcional desenha os colliders amarelos dos inimigos.
- **InputManager:** captura W/↑, A/←, D/→, Space, Q e E enquanto a partida está montada; devolve um snapshot para a simulação. Previne o comportamento padrão dessas teclas e remove listeners/reseta o input ao pausar ou destruir. Repetições de keydown não reativam teclas antigas após Resume.
- **Sistemas de gameplay:** `MovementSystem` move navios/balas; `CollisionSystem` detecta impactos; `CombatSystem` aplica dano/armas e pontua somente golpes fatais de projéteis do jogador. `SpawnSystem` controla countdown, PRNG e IDs, valida posições e chama factories. Não contém IA.
- **GameConfig:** inclui dimensões lógicas da arena e limite da nave. `Game.start(config)` copia os valores ao iniciar. Options persiste somente sessionDuration e enemySpawnInterval, derivados do mesmo GameConfig. A tela Game lê uma vez por montagem; start copia o snapshot. Factories recebem valores explicitamente; nenhuma entidade busca secretamente `DEFAULT_GAME_CONFIG`.
- **Axios:** cliente HTTP configurado com base `/api` e timeout de 10 segundos. As funções de endpoints usam esse cliente para ranking, histórico e submissão.
- **TanStack Query:** hooks `useRanking` e `useHistory` consultam as telas e armazenam os resultados em cache. `useSubmitMatch` é chamado pelo App somente para conclusões novas; status remoto por matchId fica no cache e sucesso invalida histórico/ranking.
- **MSW:** main inicia o worker também no build. POST valida e guarda conclusões em Map por ID; GET history combina fixtures válidas e registros confirmados, filtrados por jogador e paginados. Estado remoto do mock ainda é só da sessão, não persistente.
- **Playwright:** está configurado para abrir o Vite em Chromium e contém dois testes: presença dos botões do menu e navegação para o jogo/resultado/menu. Esses testes não demonstram que há gameplay real.

**Fluxo existente da interface:** `main.tsx` inicia MSW no navegador, inclusive no build e monta `App` dentro de `StrictMode` e `ReactQueryProvider`. `App` escolhe a tela. Ranking e histórico usam hooks TanStack Query → endpoints Axios → handlers MSW no ambiente de desenvolvimento.

**Fluxo da partida:** `GameCanvas` carrega texturas e liga Pixi/renderer/jogo. Game verifica lifecycle e limita delta ao tempo disponível. Cada subpasso contabiliza seu tempo ativo e executa movimento/IA → ilha → armas → impactos → Shooter → contato → spawn, então detecta time-up. Dano letal durante impactos ou contato chama finishMatch imediatamente e interrompe as ações restantes. Depois de finished, update retorna antes dos sistemas e render continua. Game publica um snapshot inicial e, após updates, somente quando HP/pontos/segundo exibido/status/motivo mudam. GameCanvas encaminha à tela React; React não decrementa o timer nem recebe coordenadas.

## 3. Decisões técnicas

### Separar a interface React da simulação do jogo

**O que foi decidido:** React controla telas e navegação; a arquitetura reserva o estado contínuo e a renderização da partida para o código de jogo/PixiJS.

**Por que fizemos assim:** uma partida atualiza muitas vezes por segundo. Manter cada posição como estado React poderia provocar renderizações de interface desnecessárias. Essa separação está registrada no `AGENTS.md` e agora é aplicada ao movimento inicial do jogador.

**Alternativas possíveis:** implementar um jogo muito simples só com DOM/React; para a arena com sprites, PixiJS já é a tecnologia escolhida.

**Como eu explicaria isso em uma entrevista:** “Eu deixaria o React responsável pelas telas e usaria o PixiJS para desenhar a partida. O estado que muda a cada frame ficaria no motor do jogo, para não atualizar toda a interface React continuamente.”

### Usar um loop com passo fixo

**O que foi decidido:** `GameLoop` acumula o tempo e chama a atualização com delta constante de 1/60 segundo; o desenho acontece a cada frame disponível.

**Por que fizemos assim:** a simulação não deve depender diretamente da taxa de atualização do monitor. O loop limita atrasos grandes e calcula um fator `alpha`, embora a interpolação ainda não tenha sido implementada.

**Alternativas possíveis:** atualizar usando todo o delta variável de cada frame, uma opção mais simples, mas que pode deixar a física e o movimento inconsistentes.

**Como eu explicaria isso em uma entrevista:** “O `requestAnimationFrame` agenda os desenhos. Para a lógica não variar com o FPS, o loop acumula o tempo e executa updates em intervalos fixos; o `delta` é o tempo usado por cada passo.”

### Separar dados de domínio dos sistemas

**O que foi decidido:** jogadores, inimigos e projéteis têm interfaces TypeScript e ficam em mapas dentro de `GameState`; classes de sistemas representam etapas de processamento.

**Por que fizemos assim:** os mapas permitem procurar e remover entidades por ID, e os tipos explícitos facilitam entender quais dados cada parte espera. Isso é a estrutura inicial, não um ECS completo.

**Alternativas possíveis:** arrays para coleções pequenas ou um framework ECS. As regras do projeto priorizam soluções simples e não recomendam introduzir um framework ECS.

**Como eu explicaria isso em uma entrevista:** “O estado da partida guarda entidades em mapas indexados por ID. Sistemas separados devem percorrer esses dados para aplicar movimento, spawn, colisão e combate.”

### Usar TanStack Query para dados remotos

**O que foi decidido:** ranking e histórico são obtidos por hooks TanStack Query; Axios faz as requisições HTTP.

**Por que fizemos assim:** essas telas dependem de respostas assíncronas e cacheáveis. Já o estado de jogo é local, mutável e contínuo, então não é papel da query cache.

**Alternativas possíveis:** usar `fetch` diretamente com estado React; seria viável, mas exigiria escrever manualmente estados de carregamento, erro e cache.

**Como eu explicaria isso em uma entrevista:** “Uso TanStack Query para consultas remotas, como ranking, porque ele organiza loading, erro e cache. A posição do navio pertence à simulação local e não a uma consulta HTTP.”

### Simular a API com MSW e testar fluxos com Playwright

**O que foi decidido:** MSW intercepta chamadas `/api` em desenvolvimento; Playwright cobre alguns caminhos da interface em Chromium.

**Por que fizemos assim:** a UI pode ser desenvolvida sem um servidor real. O teste E2E valida que a aplicação abre e que a navegação principal funciona.

**Alternativas possíveis:** usar um backend local real ou mocks escritos diretamente dentro dos componentes; o MSW mantém a simulação na fronteira HTTP.

**Como eu explicaria isso em uma entrevista:** “O MSW intercepta requisições como se fosse a API e devolve fixtures. O Playwright abre o navegador de verdade para conferir fluxos visíveis do usuário.”

### Inicializar Pixi dentro do ciclo de vida do React

**O que foi decidido:** `GameCanvas` usa ref para o container, inicializa Pixi e carrega o asset em `useEffect`, exibe estado de carregamento/erro e limpa jogo, input, renderer, textura e aplicação no cleanup. Uma flag `cancelled` cobre inicialização assíncrona após desmontagem. O ticker automático do Pixi fica desligado; o renderer é chamado pelo loop próprio.

**Por que fizemos assim:** a aplicação Pixi é um recurso externo ao DOM React e precisa acompanhar a montagem/desmontagem do componente. Isso também importa porque o app usa `StrictMode`, que em desenvolvimento pode executar o ciclo de efeito mais de uma vez para revelar problemas de cleanup.

**Alternativas possíveis:** envolver a criação em uma biblioteca de integração React/Pixi; atualmente o projeto faz a integração diretamente.

**Como eu explicaria isso em uma entrevista:** “O `useEffect` cria o Pixi quando o canvas monta e o cleanup destrói a aplicação quando desmonta. A flag impede anexar ao DOM uma instância cuja inicialização terminou depois do cleanup.”

### Capturar uma cópia da configuração no início da partida

**O que foi decidido:** `Game.start(config)` copia os valores e objetos aninhados de `GameConfig`; a simulação e a criação do jogador usam essa cópia. `DEFAULT_GAME_CONFIG` serve como padrão quando nenhum config é fornecido.

**Por que fizemos assim:** alterações posteriores no objeto de opções não devem mudar silenciosamente uma partida já iniciada. Factories recebem parâmetros explícitos em vez de importar a configuração global.

**Alternativas possíveis:** usar um objeto global mutável ou enviar cada valor isolado para sistemas. A cópia tipada mantém os valores da partida agrupados e previsíveis.

**Como eu explicaria isso em uma entrevista:** “No start, o jogo copia as opções para um snapshot. A partida usa esses valores até terminar, e os factories recebem a configuração explicitamente.”

### Armas e cooldowns no estado da simulação

**O que foi decidido:** projéteis são registros no `GameState`; Space/Q/E repetem enquanto pressionados. Cada arma tem cooldown próprio, reduzido pelo delta da simulação.

**Por que fizemos assim:** o mesmo snapshot permite mover e disparar juntos. Laterais independentes permitem disparar Q e E simultaneamente e são simples de representar. O renderer apenas desenha; uma futura pausa poderá suspender cooldowns suspendendo updates.

**Alternativas possíveis:** um disparo por keydown ou cooldown compartilhado pelas laterais. Ambos são viáveis, mas teriam comportamento diferente. `setTimeout` exigiria sincronização extra com pausa e desmontagem.

**Como eu explicaria isso em uma entrevista:** “As teclas indicam a intenção de atacar. A simulação verifica o tempo restante de cada arma, cria entidades e o Pixi mostra essas entidades.”

### Verificar o caminho do projétil contra a ilha

Registro da decisão do marco #4. No marco #5, o teste foi ampliado para retornar a primeira entrada no círculo e comparar impactos de ilha/inimigo, conforme a Etapa 8.

**O que foi decidido:** testar o segmento entre posição atual e próxima contra o círculo da ilha ampliado pelo raio da bala.

**Por que fizemos assim:** verificar apenas a posição final pode perder uma colisão se a bala atravessar o obstáculo num update rápido. A geometria funciona com qualquer proprietário do projétil.

**Alternativas possíveis:** subdividir cada movimento em passos pequenos ou verificar somente sobreposição final. O segmento evita depender da velocidade para escolher subpassos.

**Como eu explicaria isso em uma entrevista:** “Procuro o ponto do caminho mais próximo do centro da ilha. Se a distância for menor que a soma dos raios, removo a bala.”

### Inimigos com dados compartilhados e perseguição direta

**O que foi decidido:** usar o registro `Enemy` existente com tipo, posição, rotação, raio, velocidade, vida e dano de contato. O Chaser é criado por factory; presença no Map indica que ainda participa do jogo.

**Por que fizemos assim:** Chaser e futuro Shooter precisam dos mesmos dados básicos, mas não exigem herança. O SpawnSystem poderá chamar a mesma factory; neste marco só há um inimigo determinístico.

**Alternativas possíveis:** classes para cada navio ou sistema de pathfinding. A perseguição direta com correção de colisão é suficiente para estudar a base e mantém o escopo pequeno.

**Como eu explicaria isso em uma entrevista:** “Os inimigos compartilham uma interface de dados. O sistema escolhe o comportamento pelo tipo; hoje só executa a perseguição do Chaser.”

### Primeiro impacto e remoção imediata

**O que foi decidido:** escolher a menor fração de entrada no caminho da bala entre ilha e inimigos. Empates favorecem ilha; entre inimigos, a ordem de inserção no Map. Cada bala é consumida antes de aplicar dano, e inimigos mortos são removidos imediatamente.

**Por que fizemos assim:** uma ilha deve bloquear um inimigo atrás dela, mas não bloquear artificialmente um alvo atingido antes dela. A próxima bala já enxerga o estado atualizado; inimigo morto não causa contato no mesmo subpasso.

**Alternativas possíveis:** dar prioridade absoluta às ilhas ou acumular eventos e aplicar depois. Ambas exigiriam cuidado adicional para evitar resultados errados ou alvos mortos ainda consumindo balas.

**Como eu explicaria isso em uma entrevista:** “Calculo qual collider foi atingido primeiro. Removo a bala e aplico um único impacto antes de processar a próxima.”

### Shooter com alcance e cooldown individual

**O que foi decidido:** o inimigo aproxima até o alcance, mantém mira no jogador e dispara na direção atual. Cada registro Shooter tem `fireCooldownRemaining`; `Enemy` usa uma união discriminada por `type` para exigir esse campo somente no Shooter.

**Por que fizemos assim:** múltiplos Shooters futuros não devem compartilhar o relógio de disparo. O comportamento usa a base de inimigos existente e permanece fácil de explicar. Configuração de arma vem do snapshot; cooldown restante é estado da entidade.

**Alternativas possíveis:** cooldown global, tiro guiado, previsão da posição futura ou movimento lateral. Mudariam a regra solicitada e adicionariam complexidade.

**Como eu explicaria isso em uma entrevista:** “O Shooter calcula distância e aproxima só enquanto está fora do alcance. Cada um tem seu tempo restante de disparo; a bala mantém a direção calculada no momento do tiro.”

### Reutilizar projéteis com alvos separados por equipe

**O que foi decidido:** a mesma factory recebe somente os quatro parâmetros de projétil necessários. `isPlayerOwned` separa alvos válidos: jogador atinge inimigos, inimigo atinge jogador; ambos atingem ilhas.

**Por que fizemos assim:** movimento, duração, primeiro impacto e desenho são iguais para as duas equipes. Não é necessário criar outro sistema de balas. `ownerId` identifica a origem sem exigir que o atirador continue vivo.

**Alternativas possíveis:** arrays/factories separados para cada equipe ou um enum de várias facções. O boolean existente basta para duas equipes neste marco.

**Como eu explicaria isso em uma entrevista:** “Reutilizei a entidade e a simulação de projéteis. Na colisão filtro os alvos pelo proprietário antes de escolher o primeiro impacto.”

### Spawns com seed e tentativas limitadas

**O que foi decidido:** SpawnSystem próprio de cada partida usa countdown da simulação, PRNG simples e pesos no snapshot. Rejeita posições inseguras; tenta no máximo 20 vezes e pula a oportunidade se não encontrar espaço.

**Por que fizemos assim:** permite reproduzir sequências nos testes, preparar pausa por suspensão dos updates e impedir loops infinitos numa arena sem espaço. Factories criam inimigos; a IA existente continua responsável pelo comportamento.

**Alternativas possíveis:** Math.random dificulta replay; escolher de uma lista fixa de pontos é simples, mas limita variedade. Um mapa espacial aumentaria a complexidade sem necessidade nesta arena.

**Como eu explicaria isso em uma entrevista:** “Uso uma seed para gerar escolhas reproduzíveis. Antes de criar o inimigo, verifico geometria e distância; se todas as tentativas falham, aguardo o próximo intervalo.”

### Countdown autoritativo e encerramento central

**O que foi decidido:** manter duração/tempo/status em GameState, usar delta da simulação e interromper todos os sistemas pelo guard central de Game.update. Renderização continua mostrando o estado final.

**Por que fizemos assim:** evita relógios concorrentes e checks de fim espalhados por IA, movimento e combate. O mesmo bloqueio poderá suspender o timer numa futura pausa. GameState já é a fonte das regras locais.

**Alternativas possíveis:** setInterval/Date.now ou timer React. Exigiriam sincronizar o relógio com a simulação, pausa e lifecycle; não foram usados.

**Como eu explicaria isso em uma entrevista:** “O timer avança junto do jogo pelo delta. Ao chegar a zero, o Game marca finished e deixa de chamar os sistemas, mantendo o renderer desenhando a última cena.”

### Publicar snapshots de apresentação por mudança

**O que foi decidido:** Game envia um objeto pequeno, readonly e congelado, com HP máximo/atual, pontos, segundo restante e status/motivo. Canvas encaminha ao estado React da tela.

**Por que fizemos assim:** evita compartilhar Maps mutáveis e mantém regras em GameState. Comparar campos apresentados evita callback e setState em todos os ticks.

**Alternativas possíveis:** polling exigiria timer e cleanup extras; compartilhar GameState permitiria mutações e acoplamento. Store externa não é necessária.

**Como eu explicaria isso em uma entrevista:** “O jogo calcula as regras. React recebe uma cópia dos valores que mostra, apenas quando mudam.”

### Pausa pertence ao lifecycle da simulação

**O que foi decidido:** GameState usa running/paused/finished; Game.pause interrompe loop e input. Game.resume reinicia o loop sem recriar a partida.

**Por que fizemos assim:** todos os timers usam deltas da simulação; impedir updates congela cronômetro, cooldowns e spawn juntos. start do loop já limpa acumulador e redefine lastTime, descartando tempo pausado.

**Alternativas possíveis:** só desabilitar input deixaria inimigos e tempo avançarem. Um boolean React separado criaria duas fontes de lifecycle; manter RAF ativo durante pausa seria possível, mas desnecessário para cena estática.

**Como eu explicaria isso em uma entrevista:** “Pausar para o relógio da simulação, não apenas o teclado. Resume reinicia o relógio sem recuperar o período parado.”

### Opções persistidas são um subconjunto do GameConfig

**O que foi decidido:** GameOptions é Pick<GameConfig, sessionDuration | enemySpawnInterval>; gameOptions.ts centraliza validação e localStorage. A tela Game lê uma vez ao montar e passa config estável ao canvas.

**Por que fizemos assim:** defaults continuam no GameConfig, sem configuração paralela ou leitura contínua do storage. O jogo copia seus parâmetros no start e mantém a partida isolada das alterações seguintes.

**Alternativas possíveis:** manter tudo no App exigiria propagar estado sem necessidade; persistir o GameConfig inteiro permitiria dados antigos alterarem parâmetros não expostos ao usuário.

**Como eu explicaria isso em uma entrevista:** “Salvo só as duas opções permitidas. Cada partida lê uma vez e usa uma cópia; salvar depois só muda a próxima.”

### Ranking por partida e configuração completa

**O que foi decidido:** cada partida confirmada gera uma entrada; a API compara todos os campos do GameConfig usando JSON com chaves ordenadas recursivamente.

**Por que fizemos assim:** duração, spawn, dificuldade, arena e armas influenciam oportunidades de pontuar. Usar o snapshot inteiro evita comparar balanceamentos diferentes. A chave inclui até parâmetros atualmente redundantes; isso é conservador e não exige manter uma segunda lista de configuração.

**Alternativas possíveis:** selecionar explicitamente campos relevantes ou usar hash versionado. O JSON canônico é inspecionável e evita colisões de hash, embora resulte em URL maior.

**Como eu explicaria isso em uma entrevista:** “Ranking e histórico usam as mesmas partidas. Ordeno as chaves da configuração para comparar seus valores sem depender da ordem em que o objeto foi criado.”

### Salvar antes de enviar e exigir confirmação do mesmo payload

**O que foi decidido:** salvar o DTO completo antes de qualquer POST; manter pendência em falha/resultado incerto; exigir resposta válida e equivalente antes de removê-la. Retry é explícito e usa a mesma mutation, ID e snapshot originais.

**Por que fizemos assim:** refresh não pode perder o resultado entre envio e resposta. Uma resposta perdida pode esconder uma aceitação real; idempotência permite recuperar essa confirmação sem duplicar. Não supomos sucesso pela existência de um resultado local.

**Alternativas possíveis:** retry automático com backoff ou fila em IndexedDB. Nesta etapa, localStorage e botão explícito tornam o comportamento simples e previsível. Se storage negar escrita, mantemos o payload na sessão, avisamos e não começamos o POST.

**Como eu explicaria isso em uma entrevista:** “Salvo o que preciso reenviar antes da chamada. Só tiro da fila quando a API devolve a mesma partida confirmada. Se a resposta se perder, reenviar o mesmo ID recupera o registro existente.”

## 4. Diário de implementação

### Etapa 1 — Base da aplicação e telas

**Status:** Concluído (telas e navegação); integração de gameplay pendente.

**Responsável pela implementação:** Não identificado nos arquivos disponíveis; a autoria do código preexistente não está registrada. Não há histórico Git disponível nesta pasta para confirmar.

**O que foi implementado:** Aplicação Vite/React/TypeScript, provider TanStack Query, navegação local entre menu, opções, jogo, resultado, ranking e histórico. O jogo apresenta canvas vazio, HUD fixo e botão de sair que envia resultado com zeros.

**Arquivos principais envolvidos:** `src/main.tsx`, `src/app/App.tsx`, `src/app/ReactQueryProvider.tsx`, `src/screens/*`, `src/components/*`.

**Como funciona:** `App` escolhe uma tela com base em `useState`; os handlers de botões trocam o nome da tela. O payload do resultado só é salvo ao navegar para resultado com dados.

**Por que foi feito dessa forma:** O estado local do React é suficiente para uma navegação simples, sem roteador. Essa justificativa é uma leitura do desenho atual, não um registro histórico do autor.

**O que eu preciso entender:** Renderização condicional, props e callbacks, `useState`, composição de componentes, desmontagem ao trocar de tela.

**Como testar manualmente:** Rodar `npm run dev`; conferir menu e abrir opções, ranking, histórico e jogo; sair da partida e verificar a tela de resultado. No jogo, esperar ver canvas azul vazio e dados placeholder.

**Possíveis perguntas de entrevista:**
- Por que a tela atual usa estado local? “A navegação é pequena e local; `useState` atende sem adicionar um roteador.”
- O jogo já funciona? “A tela e o canvas existem, mas a simulação ainda não está conectada; o botão de sair mostra um resultado fixo.”

### Etapa 2 — Cliente HTTP, consultas e mock de API

**Status:** Concluído como base; submissão existe, mas não está conectada à partida.

**Responsável pela implementação:** Não identificado nos arquivos disponíveis.

**O que foi implementado:** Cliente Axios, funções para ranking/histórico/submissão, hooks de query/mutation, fixtures paginadas e handlers MSW.

**Arquivos principais envolvidos:** `src/api/*`, `src/hooks/useApi.ts`, `src/mocks/*`, `src/screens/Ranking.tsx`, `src/screens/MatchHistory.tsx`, `src/main.tsx`.

**Como funciona:** As telas chamam hooks TanStack Query; os hooks usam funções Axios; em desenvolvimento, MSW intercepta `/api` no navegador e responde com fixtures. Sucesso na mutation invalida ranking e histórico.

**Por que foi feito dessa forma:** Assim, a interface pode exercitar carregamento e respostas sem depender de backend. O envio de partida ainda não é acionado pelo jogo.

**O que eu preciso entender:** Promises, estados de loading/erro, query key, cache e invalidação; diferença entre mock de API e backend.

**Como testar manualmente:** Em desenvolvimento, abrir ranking e histórico e observar os dados de fixture. O POST pode ser exercitado quando a mutation for conectada a uma ação; no estado atual não há botão que a chame.

**Possíveis perguntas de entrevista:**
- O que TanStack Query resolve? “Gerencia consultas assíncronas e cache, incluindo estados de carregamento e erro.”
- O MSW grava os resultados? “Não. O handler atual devolve uma resposta simulada; não persiste a partida.”

### Etapa 3 — Canvas PixiJS e estrutura de partida

**Status:** Em andamento (canvas, input, jogador e movimento implementados; outros sistemas pendentes).

**Responsável pela implementação:** Não identificado nos arquivos disponíveis.

**O que foi implementado na base original:** Criação assíncrona do `Application` em `GameCanvas`, loop fixo, contratos de estado/configuração, input por teclado e factories iniciais. A integração de gameplay foi concluída na Etapa 5 abaixo.

**Arquivos principais envolvidos:** `src/components/GameCanvas.tsx`, `src/game/core/*`, `src/game/rendering/GameRenderer.ts`, `src/game/input/InputManager.ts`, `src/game/entities/*`, `src/game/systems/*`, `src/config/gameConfig.ts`, `src/types/domain.ts`.

**Como funciona:** Neste registro inicial, as classes estavam separadas. A Etapa 5 registra a conexão e a fatia de movimento implementadas depois.

**Por que foi feito dessa forma:** A estrutura separa responsabilidades para permitir evoluir simulação, input e desenho sem colocar atualização por frame no React. A justificativa segue o `AGENTS.md`; a Etapa 5 ligou essas peças para o movimento inicial, enquanto o restante do gameplay continua pendente.

**O que eu preciso entender:** Lifecycle do Pixi, cancelamento de init assíncrona, fixed timestep, `delta time`, snapshot de input, interpolação e ownership da configuração. Spawn, colisão e combate continuam em scaffolding.

**Como testar manualmente:** No estado original, abrir o jogo confirmava apenas que a área Pixi era montada e removida; navio e controles foram adicionados na Etapa 5.

**Possíveis perguntas de entrevista:**
- Por que a posição do navio não está em `useState`? “Ela pertence ao estado mutável da partida e é atualizada pelo loop; React não renderiza novamente a cada update.”
- O `alpha` já interpola sprites? “Não. O loop calcula o valor, mas o renderer ainda não o usa.”

### Etapa 4 — Testes E2E iniciais

**Status:** Concluído como configuração e casos escritos; execução nesta inspeção não verificada.

**Responsável pela implementação:** Não identificado nos arquivos disponíveis.

**O que foi implementado:** Configuração Playwright para Chromium, servidor Vite de teste e dois casos para menu e navegação.

**Arquivos principais envolvidos:** `playwright.config.ts`, `tests/app.spec.ts`, `package.json`.

**Como funciona:** Playwright inicia/reutiliza o servidor e usa locators por papel/nome para verificar botões, títulos e transições de tela.

**Por que foi feito dessa forma:** Os casos verificam comportamento externo da aplicação no navegador, além de checagens de tipo/build.

**O que eu preciso entender:** E2E, locators acessíveis, asserções assíncronas e diferença entre testar navegação e testar regras de jogo.

**Como testar manualmente:** Rodar `npm test` (Playwright pode exigir browser instalado). Os testes atuais verificam apenas menu e navegação; não cobrem gameplay.

**Possíveis perguntas de entrevista:**
- O que torna isso um teste E2E? “Ele abre o app em um navegador e verifica o fluxo da perspectiva do usuário.”
- Esses testes validam colisões? “Não; colisões ainda não foram implementadas nem cobertas.”

### Etapa 5 — Arena e movimento inicial do jogador

**Status:** Concluído para o primeiro vertical slice.

**Responsável pela implementação:** Codex, com base na arquitetura preexistente. A autoria das etapas anteriores continua não identificada.

**O que foi implementado:** Conexão `GameCanvas → Game → GameLoop → InputManager → MovementSystem → GameRenderer → PixiJS`; carregamento centralizado do navio; mensagens de loading/erro; arena lógica fixa escalada responsivamente; spawn central; movimento para frente, rotação simultânea e limites; cópia de `GameConfig` por partida. Wrappers de entidades sem uso foram removidos.

**Arquivos principais envolvidos:** `src/components/GameCanvas.tsx`, `src/game/assets/gameAssets.ts`, `src/game/core/Game.ts`, `src/game/input/InputManager.ts`, `src/game/rendering/GameRenderer.ts`, `src/game/systems/MovementSystem.ts`, `src/game/entities/*.ts`, `src/config/gameConfig.ts`.

**Como funciona:** Após carregar a imagem, `GameCanvas` cria Pixi com 960 × 600 coordenadas lógicas, DPR do dispositivo e ticker automático desligado. `Game.start` copia a configuração, cria a nave e liga teclado/loop. O input é consultado por snapshot a cada update fixo. O renderer atualiza o sprite e chama `app.render()` no callback de render.

**Por que foi feito dessa forma:** Coordenadas do jogo independem do tamanho CSS; o CSS preserva 8:5 e escala a área. O loop próprio controla update e render. Um único registro `Player` evita estado duplicado em wrapper.

**O que eu preciso entender:** Vetores seno/cosseno para direção da nave, rotação em radianos, cópia de config, ciclo de vida da `Texture`, DPR versus tamanho CSS e eventos de teclado.

**Como testar manualmente:** Rodar o app, clicar Start Game, aguardar o loading, então segurar W/↑ para avançar, A/← para girar à esquerda e D/→ para girar à direita; combinar W com uma tecla de rotação e verificar os limites da arena. Sair e entrar novamente para conferir limpeza/remontagem.

**Possíveis perguntas de entrevista:**
- Como a nave pode avançar e girar ao mesmo tempo? “O snapshot guarda cada tecla separadamente; no mesmo update aplico rotação e deslocamento.”
- Por que manter coordenadas 960 × 600 se o canvas muda de tamanho? “São coordenadas lógicas; CSS escala preservando proporção, e o DPR aumenta a resolução interna.”
- Como a aplicação Pixi desenha sem dois loops? “Desligo o ticker automático da Application e chamo `app.render()` pelo callback do GameLoop.”
- Como um erro ao carregar o PNG aparece? “O loader rejeita; o efeito captura a falha e React mostra uma mensagem sem derrubar o app.”

### Etapa 6 — Marco #3: arena e ilhas

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. A arquitetura, a abordagem de colisão e o escopo foram definidos colaborativamente; Codex implementou o código.

**O que foi implementado:** Ilha com matriz explícita de 3 × 3 tiles, planta e rocha oficiais, água repetida com TilingSprite, collider circular independente da arte, resposta de deslizamento e debug opcional de colisão. Os registros das etapas anteriores foram preservados.

**Arquivos principais envolvidos:** `src/game/entities/Island.ts`, `src/types/domain.ts`, `src/game/entities/Player.ts`, `src/game/core/GameState.ts`, `src/game/core/Game.ts`, `src/game/systems/CollisionSystem.ts`, `src/game/rendering/GameRenderer.ts`, `src/game/assets/gameAssets.ts`, `src/config/gameConfig.ts`, `src/components/GameCanvas.tsx`.

**Como funciona:** A ilha nasce em (672, 240) na arena padrão 960 × 600. `Island` guarda ID, centro lógico, tiles com offsets locais e lista de círculos com offsets/raios. A composição ocupa 192 × 192; o collider da ilha tem raio 104 e o do jogador, 32. Ambos são valores explícitos em GameConfig. O renderer cria os sprites uma vez por ID, reutiliza as texturas e atualiza a posição do container. No cleanup, destrói recursivamente os display objects e depois libera as texturas carregadas.

**Assets selecionados e identificação visual:** As funções abaixo foram identificadas olhando as imagens, a folha de inspeção e `preview.png`; os nomes numéricos originais foram mantidos. `tilesheets.txt` confirma tiles de 64 × 64. Não há nomes semânticos oficiais no metadata consultado, então as descrições são o mapeamento visual usado neste marco.

| Arquivo em `public/assets/png/default/tiles` | Papel visual |
| --- | --- |
| `tile_6.png` | Canto superior esquerdo arredondado de areia, com grama no interior |
| `tile_7.png` | Costa superior de areia e transição para grama abaixo |
| `tile_9.png` | Canto superior direito arredondado |
| `tile_38.png` | Costa esquerda, areia à esquerda e grama à direita |
| `tile_39.png` | Grama interior com pequenas plantas |
| `tile_41.png` | Costa direita, grama à esquerda e areia à direita |
| `tile_54.png` | Canto inferior esquerdo |
| `tile_56.png` | Costa inferior, grama acima e areia abaixo |
| `tile_57.png` | Canto inferior direito |
| `tile_65.png` | Rocha com detalhe verde e fundo transparente |
| `tile_70.png` | Planta de folhas largas e fundo transparente |
| `tile_73.png` | Água com ondas, repetida por toda a arena |

A matriz é `[6, 7, 9] / [38, 39, 41] / [54, 56, 57]`. Ela reproduz, em escala menor, a areia periférica e grama central mostradas em `preview.png` e `sample.png`. A planta e a rocha seguem a decoração das referências; as imagens de referência completas não foram usadas como fundo porque já contêm barcos/efeitos compostos. O navio continua usando `png/default/ships/ship_1.png`.

**Detecção e resposta:** Para cada círculo da ilha, calcula-se a distância quadrática entre seu centro mundial e o centro do navio. Há sobreposição quando essa distância é menor que o quadrado da soma dos raios. O sistema reposiciona o navio na direção que vai do centro da ilha até ele, até separar os círculos. O avanço tangencial permanece, produzindo deslizamento. A rotação permanece livre. Uma folga de 0,001 evita pequenas penetrações por arredondamento; se os centros coincidirem, usa-se uma direção de saída explícita. Deslocamentos por passo são subdivididos para não pular por cima do collider.

**Por que foi feito dessa forma:** Círculos são fáceis de ajustar e explicar, e dispensam um motor de física. A arte determina a aparência; o collider determina a regra de movimento. O raio não é calculado a partir do PNG. Isso permite ajustar jogabilidade sem depender da transparência da imagem, da vela ou de plantas decorativas.

**O que eu preciso entender:** Distância quadrática, soma dos raios, normal de contato, separação de círculos, projeção/deslizamento, subpassos, coordenadas locais/mundiais, Texture compartilhada e TilingSprite. Estas partes do código foram implementadas pelo Codex dentro das decisões colaborativas; revisar antes de apresentar em entrevista.

**Como testar manualmente:**

1. Iniciar o app e clicar Start Game. Conferir água, ilha à direita/acima do navio e ausência de sprites duplicados.
2. Segurar D até a proa apontar para o centro da ilha; segurar W. Ao tocar a ilha, continuar segurando W por alguns segundos: o navio deve permanecer do lado de fora do círculo.
3. Combinar W com A ou D para contornar a borda e observar deslizamento. Aproximar novamente em diagonal.
4. Soltar W e girar junto da ilha. Depois apontar para o mar e avançar: o navio deve conseguir sair.
5. Redimensionar a janela durante a partida. Posições e colisões lógicas devem permanecer iguais; só a exibição muda de tamanho.
6. Sair e iniciar novamente duas vezes. Conferir que ilha, navio e velocidade não se duplicam.
7. Para ver os círculos, mudar `SHOW_COLLISION_DEBUG` para `true` em `GameRenderer.ts`, usar desenvolvimento e recarregar a página. Verde é o jogador; vermelho é a ilha. O flag é falso por padrão e ignorado no build de produção.

**Limitações:** Um único círculo aproxima uma ilha arredondada, sem seguir exatamente os cantos da areia. A vela/proa e alguns detalhes visuais podem sobrepor a costa sem penetrar o collider. O layout é estático e manual; não há editor/mapa genérico. A resposta foi validada para esta ilha isolada, sem prometer física completa para círculos sobrepostos ou obstáculos encostados nas bordas da arena. Não foram criados nem executados E2E neste marco.

**Validação realizada:** Scripts typecheck, build e lint passaram. O aviso preexistente de bundle maior que 500 kB continua (chunk principal aproximadamente 979 kB). Os scripts foram executados pelo npm-cli instalado porque o launcher npm do ambiente aponta para um arquivo ausente. Verificações numéricas temporárias, sem arquivos de teste adicionados, passaram para contato frontal prolongado, aproximação diagonal, rotação em contato, recuperação de centros coincidentes e avanço rápido com subpassos. A composição foi inspecionada visualmente; o fluxo completo no navegador não foi testado por E2E.

**Possíveis perguntas de entrevista:**

- Por que o collider não precisa ter exatamente o mesmo formato do sprite? “Ele representa a região de bloqueio da jogabilidade; detalhes decorativos podem ser ignorados para deixar a regra simples e previsível.”
- Por que a colisão não é calculada pelo GameRenderer? “O renderer só desenha. O sistema de colisão usa dados lógicos e funciona independentemente de sprites e tamanho da tela.”
- Por que não usamos colisão pixel-perfect? “Ela aumenta custo e complexidade; círculos ajustáveis são suficientes para esta ilha e mais fáceis de estudar.”
- Como o jogo impede o navio de atravessar uma ilha? “Verifica sobreposição após pequenos passos de movimento e afasta o navio até os círculos não se sobreporem.”
- O que aconteceria se a posição do jogador fosse controlada pelo React? “Cada atualização poderia disparar renderizações da interface e misturar o ciclo da simulação com o ciclo do React.”

### Etapa 7 — Marco #4: armas do jogador

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. Arquitetura, controles e comportamento das armas foram definidos colaborativamente; Codex implementou o código.

**O que foi implementado:** tiro frontal e duas salvas laterais de três projéteis paralelos; repetição ao segurar, cooldowns independentes, movimento temporal, remoção por duração/borda/ilha e sprites reutilizados por ID. Nenhuma lógica de inimigos, dano aplicado, pontuação ou efeitos foi adicionada.

**Arquivos principais envolvidos:** `src/config/gameConfig.ts`, `src/types/domain.ts`, `src/game/core/Game.ts`, `GameState.ts`, `src/game/input/InputManager.ts`, `src/game/entities/Projectile.ts`, `Island.ts`, `src/game/systems/CombatSystem.ts`, `MovementSystem.ts`, `CollisionSystem.ts`, `src/game/rendering/GameRenderer.ts`, `src/game/assets/gameAssets.ts` e este diário. Nenhum arquivo novo de código.

**Como funciona:**

- A bala é um registro com ID único na partida, posição, rotação/direção, velocidade, raio, dano, proprietário, `isPlayerOwned` e `lifetime` restante em segundos. Não guarda Sprite: as regras devem funcionar sem depender do desenho. O dano é somente dado reservado para integração futura.
- Rotação zero aponta para cima. O vetor frontal é `F = (sin(r), -cos(r))`. O sinal negativo no Y vem das coordenadas da tela: Y cresce para baixo. A bala frontal nasce em `posição + F × 62`.
- Esquerda usa `r - π/2`; direita usa `r + π/2`. Com o navio para cima, são vetores (-1, 0) e (1, 0). Todas as balas de uma salva compartilham a direção lateral, sem espalhamento angular.
- Cada origem lateral é `posição + lateral × 38 + F × deslocamento`. Para três balas, deslocamentos são -24, 0, +24: posições ao longo do comprimento, separadas por 24 unidades.
- `weaponCooldowns` no estado guarda front/left/right. O sistema subtrai `deltaSeconds`, limita a zero e permite disparar novamente quando pronto. Uma tolerância numérica de 1e-9 evita atrasar um update por resíduo decimal. Não usa timers nem React.
- Após movimento/correção do navio, combate cria tiros com a posição/rotação atual. `MovementSystem` move inclusive os novos tiros usando velocidade × delta e reduz lifetime. Testa saída pelo centro da bala; ao expirar, sair ou intersectar ilha, deleta do mapa.
- Colisão usa o ponto mais próximo do centro da ilha no segmento percorrido pela bala e compara distância quadrática com `(raio da ilha + raio da bala)²`. Fração do segmento limitada a [0, 1]; segmento sem movimento também é tratado. Isso inclui tiros nascidos dentro do collider.
- Renderer cria Sprite de `cannon_ball.png` com anchor central, atualiza posições e destrói somente display objects removidos. Todos compartilham a textura do loader; o cleanup existente destrói a camada inteira antes de liberar texturas. Nova partida restaura cooldowns e contador de IDs.

**Valores iniciais do snapshot:**

| Campo | Valor | Unidade/função |
| --- | --- | --- |
| projectileSpeed | 400 | unidades lógicas/s |
| projectileLifetime | 3 | segundos; alcance nominal 1200 |
| projectileCollisionRadius | 5 | unidades lógicas; PNG oficial 10 × 10 |
| projectileDamage | 25 | reservado, ainda não aplicado |
| weaponCooldowns.primary | 0,3 | segundos entre tiros frontais |
| weaponCooldowns.secondary | 1 | segundos por lateral, independentemente |
| frontShotOffset | 62 | distância da origem frontal ao centro |
| broadsideOffset | 38 | distância lateral ao centro |
| broadsideProjectileCount | 3 | tiros paralelos por salva padrão |
| broadsideSpacing | 24 | separação ao longo do navio |

**Por que foi feito dessa forma:** reaproveita entidades simples, mapa existente e timestep fixo. Todos os valores ajustáveis vêm do snapshot. Separar direção da posição de origem permite formar uma salva paralela; guardar cooldowns como números permite futura pausa sem timers adicionais.

**O que eu preciso entender:** esta implementação de código foi realizada pelo Codex. Estudar radianos, seno/cosseno, vetores perpendiculares, transformação de offsets locais, distância de ponto a segmento, mutação/remoção de Map e propriedade das texturas. A colisão por segmento é a parte matemática mais sofisticada deste marco.

**Como testar manualmente:**

1. Iniciar pelo Start Game. Sem girar, tocar Space: uma bala sai da proa e vai para cima. Segurar: repete aproximadamente a cada 0,3 s.
2. Ainda apontando para cima, tocar Q: três balas vão para esquerda, alinhadas ao comprimento. E deve espelhar para direita. Segurar Q/E: salvas a cada 1 s; Q+E libera ambos os lados.
3. Segurar W+Space; depois W+D+Q/E. Conferir movimento e disparo simultâneos e direção acompanhando a rotação no instante do tiro.
4. Da posição inicial (480, 300), tocar E: as três balas caminham em direção à ilha à direita e desaparecem na região do collider, sem atravessá-la. Repetir mirando frontalmente com D e Space.
5. Atirar para água livre: balas desaparecem ao sair da arena. Para isolar expiração, iniciar com `projectileSpeed: 40` e `projectileLifetime: 0.5` num snapshot temporário de desenvolvimento: devem sumir após cerca de 20 unidades. Esses valores são apenas procedimento, não alterações persistidas neste marco.
6. Segurar as três armas por um minuto; conferir remoção contínua. Redimensionar e observar que direção/regra permanece igual. Soltar teclas: nenhum novo tiro.
7. Sair e começar duas vezes; conferir ausência de balas antigas e duplicação de velocidade/salvas. Fora da partida, Space deve recuperar seu comportamento normal. Perder foco reseta teclas; não existe pausa implementada.

**Limitações:** collider circular aproximado da ilha; bala some sem efeito de impacto. Teste de borda usa o centro, permitindo alguns pixels parcialmente fora. Configurações pressupõem valores válidos positivos e contagem inteira; Options ainda não expõe armas nem valida estes parâmetros. Salva padrão tem três balas, mas a contagem é ajustável por config. Teclas muito rápidas entre updates podem não ser vistas pelo snapshot; o comportamento escolhido favorece segurar. Sem interpolação, dano, efeitos ou pausa. O loop existente limita atrasos longos: independência do FPS não significa recuperar todo o tempo de aba suspensa. Fluxo de navegador e E2E não foram executados neste marco.

**Possíveis perguntas de entrevista:**

- Como você calcula para onde um tiro deve viajar? “Uso seno e cosseno da rotação lógica do navio para criar a direção; multiplico pela velocidade e pelo delta.”
- Como você calcula o lado esquerdo/direito? “Subtraio ou somo π/2 à rotação; isso gira a direção em 90 graus.”
- Por que o projétil não é apenas um Sprite do Pixi? “Ele tem regras como duração, colisão e proprietário. O Sprite só representa esses dados visualmente.”
- Por que o cooldown não usa setTimeout? “Ele deve avançar com a simulação; suspender updates futuramente também suspenderá o cooldown.”
- Como evita acumular projéteis para sempre? “Deleto os que expiram, saem da arena ou atingem ilhas; o renderer destrói os sprites correspondentes.”
- Por que os tiros são independentes do FPS? “Movimento e cooldown usam segundos nos updates fixos; a frequência do desenho não define velocidade nem taxa de disparo.”

**Validação realizada:** typecheck, build e lint passaram, usando o npm-cli instalado devido ao launcher npm quebrado do ambiente. Permanece o aviso preexistente de chunk maior que 500 kB (principal: 981,44 kB minificado). `sample.png`, `preview.png` e a bala oficial foram inspecionados. Uma composição estática externa ao repositório confirmou os lados e o alinhamento da salva com as fórmulas e assets; não é captura de gameplay no navegador. Nenhum teste E2E foi criado ou executado.

### Etapa 8 — Marco #5, parte 1: base de inimigos e Chaser

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. Arquitetura, perseguição, colisão e escopo foram decididos colaborativamente; Codex realizou a implementação de código.

**O que foi implementado:** um Chaser determinístico com perseguição, rotação, bloqueio por ilha/arena, vida, dano por tiros e autodestruição ao causar contato. Sem Shooter ativo, spawns, pontuação, HUD, barras de vida, efeitos, som, pausa, game over ou API.

**Arquivos principais envolvidos:** `src/config/gameConfig.ts`, `src/types/domain.ts`, `src/game/entities/Chaser.ts`, `Shooter.ts`, `Island.ts`, `src/game/core/Game.ts`, `src/game/systems/MovementSystem.ts`, `CollisionSystem.ts`, `CombatSystem.ts`, `src/game/rendering/GameRenderer.ts`, `src/game/assets/gameAssets.ts` e este diário. Nenhum arquivo novo. A factory/config do Shooter recebeu somente os campos necessários para continuar compatível com a interface compartilhada; seu comportamento não foi implementado. GameState, Player e SpawnSystem já tinham a estrutura necessária e não foram modificados.

**Como funciona:**

- `Enemy` guarda ID, tipo, posição, rotação, raio, velocidade, health/maxHealth e contactDamage. Não guarda Pixi nem precisa de flag alive: removê-lo do Map o retira da simulação. Sistemas também ignoram health <= 0.
- Chaser padrão: vida 50, velocidade 120 unidades/s, raio 32 e contato 20. `testSpawnX=480`, `testSpawnY=100`; padding de inimigo 66. Jogador começa (480, 300), vida 100/100 e raio 32; ilha (672, 240), raio 104. O spawn padrão não sobrepõe jogador ou ilha. O campo antigo `chaser.damage=15` permanece sem uso; contato usa `contactDamage`.
- Foi escolhido `png/default/ships/ship_2.png`: vela preta com caveira, visualmente correspondente ao pirata inimigo presente em sample/preview. As referências não rotulam formalmente cada navio como Chaser/Shooter; a escolha é visual, não inferência só pelo nome.
- IA calcula `(dx, dy) = jogador - inimigo`. Divide pela distância `hypot(dx, dy)` para obter direção unitária. Deslocamento = direção × velocidade × delta, limitado à distância restante; distância zero não divide. Sem normalização, quanto mais longe o jogador, mais rápido o inimigo andaria.
- A rotação usa `atan2(dx, -dy)`, compatível com frente `(sin(r), -cos(r))` e eixo Y para baixo. O inimigo vira imediatamente para o alvo; não há velocidade angular de IA nesta etapa.
- A mesma resolução circular de ilha agora processa jogador e inimigos. Subpassos consideram velocidade/raio de ambos, para evitar atravessar a ilha em passos grandes. O Chaser pode deslizar quando a aproximação tem componente tangencial, mas pode ficar bloqueado ao apontar diretamente para o centro do obstáculo.
- Ordem de cada subpasso: mover jogador → perseguir com Chaser → corrigir ilha → atualizar armas → processar balas → processar contato. Movimento/cooldowns usam o delta do subpasso, sem acelerar ao subdividir.
- Tiro testa segmento contra círculo ampliado pelo raio da bala. A função resolve a primeira raiz da interseção e retorna fração entre 0 e 1; se já nasce sobreposto, retorna 0. Escolhe o impacto de menor fração. Ilha ganha empate e bala não atinge um inimigo atrás dela.
- `Game` remove a bala antes de pedir dano ao CombatSystem; dano é aplicado imediatamente. Com 25 por tiro, duas balas matam o Chaser de 50. Vida é limitada a zero, inimigo sai do Map e não participa de balas posteriores ou contato.
- Contato compara distância quadrática com soma dos raios ao quadrado. Chaser vivo reduz player.health em 20 e é removido. A aplicação verifica novamente sua presença, impedindo dano repetido mesmo se um evento de contato fosse entregue novamente. Vida do jogador não fica negativa; chegar a zero ainda não encerra o jogo.
- Renderer mantém mapa de sprites de inimigos com anchor central e textura compartilhada. Posição/rotação vêm do estado; ao remover a entidade, destrói o sprite. Cleanup da camada e texturas segue o lifecycle existente. Debug opcional adiciona círculo amarelo, desligado por padrão.

**Por que foi feito dessa forma:** reutiliza mapas, factories, fixed timestep e colisão circular existentes. Mantém matemática explícita, aplicação de dano no CombatSystem e desenho separado. Processar cada impacto imediatamente evita fila com alvos já mortos. A escolha por dano de tiros antes de contato torna determinístico o caso de matar um inimigo encostando no jogador.

**O que eu preciso entender:** código realizado pelo Codex neste marco colaborativo. Revisar normalização, `atan2`, convenção angular, soma dos raios, primeira raiz da interseção segmento/círculo, ordem de mutações do Map e remoção imediata. A matemática do primeiro impacto merece estudo específico antes da entrevista.

**Como testar manualmente:**

1. Start Game e não tocar em nada: Chaser preto aparece acima, aponta para baixo, aproxima-se e some ao encostar após cerca de 1,2 s. Vida lógica muda de 100 para 80 uma única vez; o HUD antigo não representa esse valor.
2. Para inspecionar vida, abrir DevTools/Sources em desenvolvimento, colocar breakpoint em `CombatSystem.applyCollision` na atribuição de player.health e iniciar novamente. Inspecionar `state.players.get('player').health`, executar a atribuição e conferir 80; seguir execução e verificar ausência de novo contato. `Game.getState()` também permite inspeção onde a instância estiver acessível no debugger. Não foi criada variável global de debug.
3. Reiniciar e imediatamente segurar Space, sem mover: duas balas devem eliminar o Chaser antes do contato. Breakpoint na atribuição de enemy.health permite conferir 50 → 25 → 0. O jogador permanece 100 e score permanece 0.
4. Reiniciar e mover/girar: ele deve perseguir a posição atual com velocidade constante, acompanhando mudanças de direção. W é mais rápido que o Chaser, permitindo afastar-se para testar.
5. Para cenário reproduzível de ilha, usar somente no debugger um breakpoint no fim de `createInitialState`: ajustar player para (440, 240) e chaser para (890, 240). Continuar: ele deve ficar bloqueado à direita da ilha sem atravessar. Mover o jogador para cima/baixo pode permitir deslizamento; não há promessa de contornar sozinho.
6. No mesmo cenário, usar no debugger `projectileSpeed=30000` no snapshot e posicionar jogador (440, 240) com rotação π/2. Disparar Space: o tiro cruza distância grande, mas a ilha deve consumi-lo sem reduzir a vida do Chaser atrás dela. Alterações de debugger são locais e se perdem ao reiniciar/recarregar.
7. No breakpoint de criação, configurar player.health=10; deixar contato acontecer. Conferir zero, nunca negativo; a partida continua porque game over está fora do escopo.
8. Redimensionar; sair e iniciar duas vezes. Deve existir somente um Chaser novo, vida restaurada e nenhuma bala/sprite antigo. Debug de colisão opcional mostra jogador verde, Chaser amarelo e ilha vermelho.

**Limitações:** perseguição direta pode ficar obstruída; não há pathfinding, suavização angular ou colisão entre inimigos. Círculos aproximam a arte. Colisão de balas trata inimigos na posição atual do subpasso, sem trajetória relativa contínua de ambos. Layout padrão mantém ilha longe das bordas; múltiplos obstáculos sobrepostos/perto das bordas não têm solução física geral. Config pressupõe raios positivos, posição de teste válida e demais valores válidos. Vida é inspecionável por debugger, sem feedback visual. HUD preexistente permanece placeholder. Nenhum fluxo completo de navegador/E2E foi executado.

**Possíveis perguntas de entrevista:**

- Como o Chaser sabe para onde ir? “Subtraio a posição dele da posição do jogador; isso dá o vetor em direção ao alvo.”
- Por que normalizamos? “Para a direção ter comprimento um e a velocidade ser definida só pela configuração.”
- E sem normalizar? “A distância aumentaria o tamanho do deslocamento, fazendo o inimigo correr mais quando longe.”
- Como evita dano repetido? “Consumo a bala antes de aplicar dano; inimigo morto ou que já causou contato é removido imediatamente.”
- Como uma ilha bloqueia um tiro? “Comparo o primeiro impacto no segmento entre ilha e inimigos; somente o mais próximo é processado.”
- Por que IA não fica no React? “Ela atualiza continuamente dados locais em passos fixos; React cuida das telas e não precisa renderizar a cada movimento.”
- Por que não implementou pathfinding? “Perseguição direta é suficiente para validar esta base; contornar obstáculos com navegação fica para uma necessidade futura.”

**Validação realizada:** typecheck, build e lint passaram pelo npm-cli instalado (launcher npm do ambiente continua quebrado). Aviso preexistente de chunk > 500 kB permanece: principal 984,52 kB minificado. Verificações numéricas temporárias, sem arquivos de teste adicionados, executaram o Game e sistemas reais com renderer/RAF substituídos: contato único 100 → 80, morte por tiros sem contato/pontos, bloqueio prolongado pela ilha, limites da arena, primeiro impacto ilha/alvo e clamp de vida em zero passaram. Essas verificações não validam Pixi ou lifecycle no navegador. Nenhum E2E foi criado/executado.

### Etapa 9 — Marco #5.3: Shooter

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. Comportamento, arquitetura e escopo foram definidos colaborativamente; Codex realizou a implementação de código. As etapas anteriores preservam seu registro histórico.

**O que foi implementado:** um Shooter vermelho determinístico junto do Chaser; aproximação limitada ao alcance, mira contínua, cooldown individual, balas inimigas, dano no jogador, friendly fire desabilitado e remoção por tiros/ilha/duração/borda. Sem novos spawns, HUD, pontuação, efeitos, game over ou APIs.

**Arquivos principais envolvidos:** `src/config/gameConfig.ts`, `src/types/domain.ts`, `src/game/entities/Shooter.ts`, `Projectile.ts`, `Island.ts`, `src/game/core/Game.ts`, `src/game/systems/MovementSystem.ts`, `CombatSystem.ts`, `CollisionSystem.ts`, `src/game/rendering/GameRenderer.ts`, `src/game/assets/gameAssets.ts` e este diário. Nenhum arquivo novo. Chaser/factory, GameState, SpawnSystem, GameCanvas e input não foram modificados.

**Como funciona:**

- Shooter usa os dados básicos de Enemy e acrescenta cooldown restante obrigatório quando `type === 'shooter'`. Não há herança nem Pixi no estado. A configuração permanece no snapshot; a factory recebe configuração explícita.
- Asset `png/default/ships/ship_3.png`, vermelho com símbolo branco, inspecionado com sample/preview. É visualmente distinto do jogador branco e Chaser preto, sem afirmar que as referências rotulam formalmente os tipos. Bala é o mesmo `ship_parts/cannon_ball.png` oficial.
- Nasce em (100, 300), separado do jogador (480, 300), Chaser (480, 100) e ilha (672, 240). Distância inicial de 380 permite observar 80 unidades de aproximação. Com jogador parado, chega a (180, 300) após aproximadamente 0,89 s e passa a disparar.
- Distância é `hypot(player.x - enemy.x, player.y - enemy.y)`. `atan2(dx, -dy)` orienta mesmo parado. Shooter move por direção normalizada × velocidade × delta, limitado à distância que falta para entrar no alcance. Chaser mantém sua perseguição anterior.
- A mira usa a posição atual, sem previsão. Origem da bala é centro do Shooter + direção normalizada × 62. A rotação/direção da bala fica fixa depois de criada, permitindo esquiva.
- `fireCooldownRemaining` começa em zero, reduz pelo delta também fora do alcance e reseta para 1,5 s ao disparar. O sistema usa pequena tolerância numérica no limite de alcance/cooldown. Na futura pausa, parar updates suspenderá esse relógio; não há timers.
- A factory de projétil aceita `Pick<GameConfig, ...>` dos quatro campos necessários, permitindo receber config geral ou `config.shooter`. Ambos geram a mesma entidade. IDs usam o mesmo contador da partida; bala inimiga tem `ownerId` do Shooter e `isPlayerOwned=false`.
- Primeiro impacto compara a entrada no círculo em todo o segmento. Ilha participa para ambos os lados e ganha empate. Bala do jogador considera somente inimigos vivos; bala inimiga considera somente jogadores. Não há bala contra bala nem fogo amigo.
- Bala é consumida antes do dano: inimiga reduz vida do jogador em 10 uma vez, limitada a zero; do jogador reduz vida do Shooter em 25. Dois impactos removem um Shooter de 50. Score continua sem alteração.
- Ordem: movimento/IA, correção de ilha, armas do jogador, movimento/impacto de balas existentes, armas de Shooters sobreviventes, contato do Chaser. Assim, Shooter morto neste subpasso não dispara. Balas inimigas novas aguardam o próximo subpasso para mover; balas já disparadas continuam existindo mesmo após morte do proprietário.
- Shooter reutiliza bloqueio de movimento com ilha e limites. Não recebe autodestruição ou dano de contato do Chaser. Sobreposição física com jogador não é resolvida neste marco e não remove o Shooter.
- Renderer usa o mapa existente de inimigos e seleciona textura pelo tipo, sem recriar Sprite por frame. A mesma camada de balas desenha ambas as equipes; debug existente já cobre os dois colliders.

**Valores finais em `config.shooter`:**

| Campo | Valor | Função |
| --- | --- | --- |
| health | 50 | vida inicial/máxima |
| speed | 90 | unidades lógicas/s |
| collisionRadius | 32 | círculo do navio |
| attackRange | 300 | distância entre centros |
| fireCooldown | 1,5 | segundos por disparo |
| projectileSpeed | 260 | unidades lógicas/s |
| projectileDamage | 10 | dano no jogador |
| projectileLifetime | 3 | segundos; alcance nominal 780 |
| projectileCollisionRadius | 5 | raio da bala |
| projectileSpawnOffset | 62 | distância da origem frontal |
| testSpawnX / testSpawnY | 100 / 300 | posição determinística |

Os antigos campos sem uso `fireRate`, `preferredDistance` e `damage` do Shooter foram substituídos por nomes explícitos. A configuração de Chaser e armas do jogador foi preservada.

**Por que foi feito dessa forma:** alcance é uma decisão simples por distância, sem estados artificiais de IA. Separar cooldown por entidade prepara a factory para futuros spawns. Um único modelo de bala evita duplicar lifecycle/movimento; filtro de equipe e primeiro impacto mantêm as regras explícitas. Mira instantânea é mais simples e permite esquiva, sem predição.

**O que eu preciso entender:** implementação de código pelo Codex. Revisar união discriminada TypeScript, narrowing por `type`, `Pick`, normalização, distância entre centros, direção armazenada na bala, ordem dos sistemas, cooldown independente e por que uma bala não precisa de proprietário vivo.

**Como testar manualmente:**

1. Start Game: preto aparece acima e vermelho à esquerda. Shooter aproxima e para por volta de x=180 se o jogador não mover. Ele aponta à direita e dispara aproximadamente a cada 1,5 s.
2. Para isolar Shooter, segurar Space imediatamente e eliminar o Chaser. Depois observar as balas vindo da esquerda. HUD antigo não mostra vida real.
3. Em DevTools/Sources, breakpoint na atribuição de health em `CombatSystem.applyCollision`, ramo `projectile-player`: inspecionar `state.players.get('player').health`. Cada impacto reduz 10, sem repetir após remoção; chegar a zero ainda não encerra a partida.
4. Depois de eliminar o Chaser, usar W para mover perpendicularmente aos tiros. Uma bala já disparada segue reta; a mira do Shooter acompanha o novo alvo. Ao ficar além de 300, ele volta a aproximar.
5. Reiniciar, eliminar Chaser e segurar Q sem girar: duas balas válidas devem matar Shooter. Algumas balas inimigas em voo podem continuar e atingir o jogador após essa morte; isso é esperado. Score permanece zero.
6. Para cobertura reproduzível, breakpoint no fim de `createInitialState`, usar `this.state` não é possível porque ainda não foi atribuído: ajustar as variáveis locais `player` para (520, 240) e `shooter` para (820, 240), e retirar Chaser pelo Map do estado após o start via debugger. Shooter em alcance aponta através da ilha; as balas nascem dentro do collider e devem ser consumidas sem atingir o jogador.
7. Para observar bloqueio de movimento, posicionar via debugger jogador (440, 240) e Shooter (890, 240), sem Chaser. Ele tenta aproximar, mas não atravessa a ilha. Mudar a posição do jogador pode permitir deslizar; não há navegação planejada.
8. Para primeiro impacto em velocidade alta, usar via debugger `this.configSnapshot.shooter.projectileSpeed=30000` e `attackRange=600`, jogador (440, 240), Shooter (890, 240). Ilhas devem consumir tiros antes do jogador, mesmo num segmento grande. Ajustes de debugger não são persistidos.
9. Mover sobre o Shooter: não deve ocorrer autodestruição nem dano de contato; ainda pode haver tiros. Redimensionar, sair e iniciar duas vezes: sempre um Chaser e um Shooter novos, sem balas antigas ou duplicação.

**Limitações:** sem pathfinding, recuo, movimento lateral, previsão ou velocidade angular. Shooter pode ficar bloqueado pela ilha; pode sobrepor jogador/inimigos. Com jogador muito próximo, a origem frontal pode ficar além dele e tiros podem errar. Não há verificação de linha de visão antes de disparar: ilha consome o tiro. Balas de ambas as equipes têm a mesma arte. Config presume valores válidos. Colisão trata alvos na posição atual do subpasso. Não existe pausa/game over nem feedback de vida; interface continua placeholder. Nenhum fluxo completo de navegador/E2E foi executado.

**Possíveis perguntas de entrevista:**

- Como decide quando parar? “Calcula a distância e só avança a parte que falta para entrar no alcance.”
- Como mira no jogador? “Normaliza jogador menos Shooter e usa essa direção para origem, rotação e movimento da bala.”
- Por que o tiro não acompanha o jogador? “Sua direção é definida uma vez no disparo; não existe atualização de mira na entidade da bala.”
- Por que cada Shooter tem cooldown próprio? “Cada inimigo precisa poder disparar sem depender do relógio dos outros.”
- Como reutilizou projéteis? “Mesma factory, entidade, movimento, lifetime e renderer; apenas config e alvos válidos mudam.”
- Como ilha vira cobertura? “Ela disputa o primeiro impacto no segmento; se está antes do jogador, consome a bala.”
- Como impede fogo amigo? “Bala inimiga não verifica inimigos como alvos, apenas jogador e ilhas.”
- Qual a diferença arquitetural de Chaser e Shooter? “Compartilham dados e colisões básicas; Chaser persegue até contato, Shooter para no alcance e possui cooldown de arma.”

**Validação realizada:** typecheck, build e lint passaram pelo npm-cli instalado; launcher npm quebrado é condição preexistente do ambiente. Aviso de chunk > 500 kB permanece (principal 986,16 kB minificado). Verificações numéricas temporárias, sem arquivos de teste adicionados, executaram Game/sistemas reais com renderer/RAF substituídos: aproximação/parada/mira, direção fixa das balas, cooldown individual, dano único/clamp, morte com dois tiros, primeiro impacto/filtro de equipes e regressão do contato do Chaser passaram. Assets/referências foram inspecionados visualmente. Não houve execução de gameplay no navegador nem E2E; lifecycle e desenho não são garantidos por essas verificações numéricas.

### Etapa 10 — Marco #6: Spawn System

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. Distribuição 60/40, estratégia determinística, arquitetura e regras foram decididas colaborativamente; Codex implementou o código.

**O que foi implementado:** criação periódica de inimigos por SpawnSystem, escolha ponderada com seed, validação de posição, tentativas limitadas e reset por partida. Removidos os dois inimigos temporários do start e os campos testSpawnX/Y. As etapas 8 e 9 preservam o registro do comportamento temporário daquele momento; seus testes de posição fixa precisam agora ser preparados via debugger/factory.

**Arquivos principais envolvidos:** criado `src/game/core/SeededRandom.ts`; modificados `src/config/gameConfig.ts`, `src/game/core/Game.ts`, `src/game/systems/SpawnSystem.ts` e este diário. Factories, tipos de entidades, GameState, IA, combate, colisões, renderer e assets foram reaproveitados sem alteração.

**Como funciona:**

- Partida começa sem inimigos; primeira tentativa após 3 s de simulação. Countdown fica no SpawnSystem e diminui pelo delta de cada subpasso. Ao vencer, tenta uma criação e soma o intervalo ao restante, preservando o pequeno atraso entre ticks. Se um update excepcional vence vários intervalos, faz somente uma tentativa e descarta a dívida restante; não gera rajada atrasada.
- `SeededRandom` usa LCG: estado seguinte = `(1664525 × estado + 1013904223) mod 2³²`. `Math.imul` e `>>> 0` fazem a aritmética de 32 bits; dividir por 2³² retorna valor em [0, 1). Essas constantes pertencem ao algoritmo, não ao balanceamento. Seed inteira é convertida para unsigned de 32 bits, inclusive zero; números equivalentes módulo 2³² geram a mesma sequência. Não é criptografia.
- Cada oportunidade consome um valor para o tipo: sorteio × soma dos pesos menor que peso Chaser escolhe Chaser, senão Shooter. Pesos 60/40 produzem probabilidades 60%/40%, sem garantir essa proporção exata em poucas tentativas. Também aceita 1/0 e 0/1.
- Tipo é escolhido uma vez; cada tentativa de posição consome dois números, X e Y uniformes dentro do retângulo permitido. Margem efetiva é `max(raio do inimigo, enemySpawnMargin, enemyBoundaryPadding)`: o círculo cabe e a posição respeita o mesmo limite da IA.
- Rejeita posição fora da arena, sobreposta a qualquer collider de ilha, muito próxima do jogador ou sobreposta a inimigo vivo. Distância ao jogador precisa superar `max(320, raio inimigo + raio jogador)`. Ilha usa centro mundial e soma dos raios; tangência também é rejeitada por segurança. Inimigo com vida zero não bloqueia posição.
- Depois de no máximo 20 posições rejeitadas, nada é criado; próxima oportunidade permanece no intervalo normal. Arena menor que a margem necessária também pula o spawn. Não usa while infinito, timers ou bounds Pixi.
- IDs `enemy-1`, `enemy-2` etc. avançam somente após spawn válido, sem sortear ID. Factory Chaser/Shooter existente recebe config do snapshot; rotação inicial aponta para o jogador. Nenhuma IA foi copiada para SpawnSystem.
- Game chama spawn no fim do subpasso, após combate/contato; o novo inimigo preserva a posição validada e passa a agir no próximo. Renderização já reconhece as novas entidades pelo mapa/ID. `state.isRunning=false` impede avanço do spawn; GameLoop parado não chama updates.
- Novo start cria outro SpawnSystem: countdown, estado do PRNG e contador retornam ao início. Destroy libera a referência. Config copia também `enemySpawnWeights`, impedindo mudança externa da distribuição no meio da partida.
- `SeededRandom.next`, `SpawnSystem.update/isValidPosition` e `Game.getState` permitem verificações de código. Não existe debug UI nem variável global em window.

**Valores finais:**

| Campo de GameConfig | Valor | Significado |
| --- | --- | --- |
| enemySpawnInterval | 3 | segundos de simulação; preservado |
| enemySpawnWeights | Chaser 60 / Shooter 40 | pesos relativos |
| enemySpawnMinimumDistance | 320 | distância entre centros |
| enemySpawnMaxAttempts | 20 | posições por oportunidade |
| enemySpawnMargin | 66 | margem mínima do centro à borda |
| enemySpawnSeed | 12345 | sequência padrão reproduzível |

Constructor rejeita intervalo não positivo/não finito, pesos inválidos/soma zero, tentativas não inteiras positivas, seed não inteira e margem/distância inválidas. Não é validação completa de todo GameConfig. `enemySpawnInterval` mantém nome e unidade para futura Options; a tela atual ainda é scaffolding e não salva/aplica esse valor. Não foi integrada neste marco.

**Por que foi feito dessa forma:** spawn é criação e validação, não comportamento. Seed fixa facilita estudar/reproduzir problemas. Distância 320 evita contato imediato e está além do alcance padrão 300 do Shooter. Limite de tentativas impede travamento; pular é melhor que forçar posição inválida.

**O que eu preciso entender:** código pelo Codex neste marco colaborativo. Revisar aritmética unsigned/Math.imul, seed versus estado do gerador, pesos relativos, teste de distância quadrática, efeito das rejeições no consumo aleatório e reset de lifecycle. Mesma seed sozinha não garante replay se jogador/config/obstáculos ou ordem de chamadas mudarem.

**Como testar manualmente:**

1. Start Game: arena começa sem inimigos. Após cerca de 3 s, aparece o primeiro; há nova oportunidade aproximadamente a cada 3 s, enquanto houver posição válida.
2. Sem mover antes do primeiro spawn e com config padrão, primeiro é Chaser perto de (79,70; 320,20), ID enemy-1. Repita saindo e iniciando: esse primeiro resultado deve ser igual. Não compare posições posteriores após inputs diferentes.
3. Jogue por 30–60 s, usando W/A/D e Space/Q/E: observar Chasers perseguindo, Shooters parando/disparando e ambos recebendo dano. Cada aparição deve estar longe da posição atual do jogador e fora da ilha/bordas.
4. DevTools/Sources, breakpoint em `SpawnSystem.update` na inserção no Map: inspecionar x/y, tipo, ID e raio antes da criação; confirmar `isValidPosition(state,x,y,radius)` e cooldown individual dos Shooters criados.
5. Para cenário sem espaço, no debugger antes da primeira tentativa aumentar o raio do collider da ilha para 10000. Após 20 tentativas, não deve nascer inimigo nem travar. Restaurar raio 104: próxima oportunidade poderá criar normalmente.
6. Para variar sequência, alterar `enemySpawnSeed` no config fornecido a uma nova partida (ou via debugger antes de construir SpawnSystem). Usar 54321 deve produzir sequência diferente. Alterar seed depois da construção não reseta o gerador.
7. Testar snapshot de desenvolvimento com intervalo 1 s e pesos 1/0, depois 0/1: muda frequência/tipo sem alterar IA. Não há controles de Options para isso ainda.
8. Redimensionar durante o jogo: apenas exibição muda. Sair e reiniciar duas vezes: espera inicial continua 3 s, ID recomeça em enemy-1, sem aceleração/entidades anteriores. Os ajustes de debugger não são persistidos.

**Limitações:** seed padrão fixa gera a mesma sequência quando o restante da simulação é igual; variedade entre partidas exige fornecer outra seed. Não força ambos os tipos nem proporção exata em toda sequência curta. Spawn válido considera círculos, não contorno completo da arte. Sem limite adicional de inimigos vivos, partida infinita pode acumular entidades; falta de espaço apenas pula spawns. Não há garantia de rota até o jogador, prevenção de aglomeração após nascer ou balanceamento de dificuldade. Intervalos menores que um subpasso ficam limitados a uma tentativa por subpasso. Game over/pausa continuam pendentes, inclusive vida zero não interrompe spawns. Testes numéricos não validam navegador/lifecycle Pixi.

**Possíveis perguntas de entrevista:**

- Por que não usa setInterval? “O spawn avança pelo delta da simulação; ao suspender updates, seu relógio também para.”
- Por que usar seed? “Permite repetir as escolhas aleatórias com a mesma sequência de chamadas e reproduzir um problema.”
- Como evita nascer dentro da ilha? “Comparo distância ao centro de cada collider com a soma dos raios.”
- Como evita nascer em cima do jogador? “Exijo distância mínima configurada e também separação dos círculos.”
- Por que limitar tentativas? “Pode não existir espaço livre; o limite garante que o update termine e tente novamente depois.”
- Qual a diferença entre spawn e IA? “Spawn cria a entidade numa posição válida; IA decide seu movimento e ataque depois.”
- Como testar algo aleatório? “Fixo seed, config, estado e deltas, e comparo tipos/posições entre execuções.”

**Validação realizada:** typecheck, build e lint passaram usando npm-cli instalado, devido ao launcher npm quebrado do ambiente. Aviso preexistente de chunk > 500 kB permanece: principal 988,54 kB minificado. Verificações temporárias de código, sem arquivos de teste adicionados, passaram para repetição de tipos/posições com mesma seed, mudança com seed diferente, 200 spawns por execução em timestep fixo, raio/distância/ilha/bordas, rejeição de inimigo vivo, intervalo inicial, pesos 1/0 e 0/1, limite exato de 20 tentativas, pular e tentar no próximo intervalo, estado parado, snapshot dos pesos e reset do Game/IDs/PRNG. Também passou intervalo fracionário de 0,025 s com deltas de 0,01 s (40 oportunidades em 1 s). Não foram criados/executados E2E, nem realizado gameplay no navegador.

### Etapa 11 — Marco #7, parte 1: timer e término por tempo

**Status:** Concluído.

**Responsável pela implementação:** Colaborativo. Arquitetura do timer, tempo da simulação e escopo de encerramento foram decididos colaborativamente; Codex implementou o código.

**O que foi implementado:** duração validada de 60 a 180 s, countdown com delta, time-up único e congelamento de toda simulação. Sem pontuação, derrota por vida zero, navegação automática de resultado, HUD, pausa ou API.

**Arquivos principais envolvidos:** `src/config/gameConfig.ts`, `src/game/core/GameState.ts`, `Game.ts`, `src/game/systems/SpawnSystem.ts` e este diário. Nenhum arquivo novo. GameLoop, GameCanvas, telas, IA, combate e renderer foram inspecionados e preservados.

**Como funciona:**

- Usa o campo existente `GameConfig.sessionDuration`, padrão 120. `SESSION_DURATION_LIMITS` centraliza min=60 e max=180 para validação no start e futura UI. Valores não finitos ou fora da faixa são rejeitados. Options atual não possui duração funcional nem persistência; não foi criada outra configuração.
- Estado nasce com durationSeconds e remainingSeconds iguais ao snapshot, elapsedSeconds=0, status=running e finishReason=null. Tipos de motivos existentes permitem expansão futura, mas só time_expired é disparado neste marco.
- Game.update verifica status antes de qualquer input/sistema. Limita delta ao remainingSeconds, evitando mover além do fim num update que exceda o tempo restante. Cada subpasso usa só o tempo disponível, executa gameplay e depois faz remaining = max(0, remaining - delta).
- Não arredonda countdown por frame. Remove somente resíduo decimal até 1e-9 s próximo de zero, para não atrasar um tick por erro de ponto flutuante. elapsedSeconds é derivado de duração menos restante; ao terminar fica exatamente igual à duração.
- Ao remaining <= 0, finishMatch marca finished/time_expired e desanexa/reset input. O método e o update têm guard de status, impedindo repetir a transição. Atualizações posteriores não alteram posições, HP, projéteis, cooldowns, IDs, PRNG nem countdown de spawn.
- Os sistemas processam o último período ativo antes da transição. Um evento/spawn ocorrido nesse período pode fazer parte da cena final; nada é processado depois de finished. O renderer não limpa entidades no fim: mantém a última cena e GameLoop continua renderizando.
- SpawnSystem reutiliza o novo status em seu guard existente, sem timer de duração próprio. Game não o chama após o fim. Futuro pause deverá bloquear updates sem correção por relógio externo; isso congelará tempo e sistemas juntos. Pause ainda não existe.
- Start após finished reinicia o loop sem duplicação e recria estado/SpawnSystem: duração cheia, status running, motivo null, mapas limpos e sequência de spawn resetada. Sair/reabrir a tela também continua usando o cleanup existente.

**Por que foi feito dessa forma:** Game concentra lifecycle e coordenação. Tempo é parte da simulação, independente da quantidade de renders. Limitar o último delta preserva movimento proporcional ao tempo válido. Manter o renderer ativo conserva a cena final sem misturar término com destruição de recursos.

**Como o timer chegará ao HUD depois:** hoje somente `Game.getState()`/debugger expõem os dados; não há callback conectado nem React state de countdown. Em uma etapa futura, Game pode emitir snapshot com segundo apresentado, score, HP e status apenas quando mudarem, passando por GameCanvas à tela. React formatará o tempo (por exemplo ceil/segundos), sem diminuir o valor nem renderizar a 60 Hz. O desenho desse mecanismo é uma recomendação, não integração já implementada.

**O que eu preciso entender:** implementação realizada pelo Codex neste marco colaborativo. Revisar tempo de simulação versus relógio real, deltas/subpassos, resíduo de ponto flutuante, estado autoritativo, último delta parcial, guard de lifecycle e diferença entre congelar regras e parar renderização.

**Como testar manualmente:**

1. Start Game com config padrão. DevTools/Sources: breakpoint no fim de createInitialState; inspecionar duração 120, restante 120, status running e motivo null.
2. Para observar countdown, breakpoint na atribuição de remainingSeconds em Game.update: restante cai pelo delta do subpasso; elapsed é duração menos restante. HUD Time permanece -- porque não foi integrado.
3. Para teste rápido sem violar faixa de produção, pause dentro de Game.update e ajuste somente o estado pelo debugger: `this.state.remainingSeconds = 2; this.state.elapsedSeconds = this.state.durationSeconds - 2`. Continue e jogue: após cerca de 2 s simulados a arena deve congelar. A configuração da partida permanece válida.
4. Breakpoint em finishMatch: verificar remaining=0, status finished e finishReason=time_expired. Segurar W/A/D/Space/Q/E depois disso não deve mover, disparar, aplicar dano ou gerar novos inimigos; esperar vários intervalos de spawn e conferir cena congelada.
5. Sair pelo botão existente e iniciar novamente: tempo volta a 120, sem inimigos/balas antigos; primeiro spawn após 3 s. O botão Quit mantém seu comportamento anterior de navegação; time-up não navega automaticamente.
6. Com snapshots válidos de 60 e 180 s em desenvolvimento, confirmar os dois limites. Para estudar precisão, os checks de código executam todos os ticks aceleradamente, sem esperar minutos no navegador. Não foi exposta duração curta na UI.
7. Vida zero deve continuar permitindo gameplay até expirar o tempo, pois derrota ainda não foi implementada. Redimensionamento mantém a cena; blur apenas reseta input, sem pausa automática nesta etapa.

**Limitações:** sem timer visível real, mensagem de término, resultado automático, derrota ou pause. O loop continua renderizando a cena congelada; isso mantém uso de RAF até sair. O GameLoop existente limita atrasos a 250 ms e não recupera todo tempo de aba suspensa, portanto segundos simulados podem divergir do relógio de parede. A tolerância final trata erro numérico inferior a um nanossegundo; não é arredondamento da apresentação. Testes com renderer substituído não garantem Pixi/lifecycle no navegador.

**Possíveis perguntas de entrevista:**

- Por que não usa setInterval? “O tempo deve avançar junto da simulação; timer separado exigiria sincronização com pausa e fim.”
- Onde está o estado autoritativo? “Em GameState. React poderá mostrar uma cópia formatada, sem controlar a contagem.”
- Como não depende do FPS? “Desconto o delta dos updates fixos, não a quantidade de desenhos.”
- O que acontece em zero? “Limito a zero, marco finished/time_expired e bloqueio sistemas pelo Game.”
- Como impede spawn após o fim? “O guard central não chama SpawnSystem; seu countdown e PRNG ficam parados.”
- Por que React não controla countdown? “Ele controla telas; tempo e regras contínuas precisam compartilhar o relógio da simulação.”
- Como isso facilita pausa? “Basta suspender updates: countdown, armas e spawns param juntos, sem timers externos.”

**Validação realizada:** typecheck, build e lint passaram pelo npm-cli instalado; launcher npm quebrado é condição preexistente. Aviso de chunk > 500 kB permanece: principal 989,58 kB minificado. Verificações temporárias, sem arquivos de teste adicionados, passaram para desconto por delta, snapshot da duração, validação 60–180, último passo limitado a 0,005 s, zero exato, transição única, freeze completo do estado e internos do spawn após 600 updates, render recebendo estado final, reset no start após finished, deadlines em 3600/7200/10800 ticks e ausência de término por vida zero. Renderer/RAF foram substituídos nesses checks; nenhum gameplay de navegador ou E2E foi executado.

### Etapa 12 — Marco #7, parte 2: pontuação e derrota

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Regras, valores e lifecycle foram decididos em colaboração; Codex implementou o código.

**O que foi implementado:** score no GameState, recompensas tipadas por tipo, atribuição do golpe fatal, proteção contra duplicação, derrota por HP zero e congelamento central reutilizado do timer.

**Conformidade com as instruções originais:** o pedido anexado propunha Chaser 10/Shooter 20, mas INSTRUCOES.md exige 1 ponto por inimigo destruído pelos ataques do jogador. Conforme orientação anterior do usuário, Codex pausou e apontou o conflito antes de alterar código. O usuário confirmou seguir a regra original: Chaser 1, Shooter 1, autodestruição 0. Registrar também no relatório para o agente coordenador respeitar as instruções originais e consultar o usuário diante de conflitos futuros. Isso não autoriza implementar todos os requisitos originais de uma vez.

**Arquivos principais envolvidos:** src/config/gameConfig.ts; src/game/core/Game.ts; src/game/core/GameState.ts; src/game/systems/CombatSystem.ts; src/game/systems/CollisionSystem.ts; este diário.

**Como funciona:**

- enemyKillRewards contém chaser: 1 e shooter: 1, copiados no snapshot do start. CombatSystem não contém recompensas literais.
- CollisionEvent de projétil contra inimigo exige isPlayerOwned. Game preserva essa informação antes de consumir o projétil. CombatSystem verifica inimigo vivo, aplica dano limitado a zero e, somente no golpe fatal do jogador, soma a recompensa e remove o inimigo imediatamente.
- Remoção por contato não passa pela pontuação: aplica dano uma vez e remove o Chaser. Eventos seguintes encontram entidade ausente. Vários tiros no mesmo passo não podem pontuar a mesma morte novamente.
- Game verifica HP após cada impacto inimigo e cada contato; HP é limitado a zero e finishMatch('defeated') encerra imediatamente. Nenhum projétil posterior, contato posterior ou spawn é processado. Em derrota por projétil, nem os disparos de Shooter seguintes são processados. Disparos já executados antes de um contato letal permanecem na cena final.
- O tempo do subpasso ativo é contabilizado antes das regras, sem precisão subframe do instante do impacto. Expiração é reconhecida ao final. Dano letal no último subpasso vence; se o update já começa sem tempo, time_expired vence antes de processar dano. finishMatch só aceita running e preserva o primeiro motivo.
- Guard central bloqueia updates posteriores: score, HP, movimento, projéteis, cooldowns e spawn ficam congelados. Input é removido/resetado; RAF continua desenhando a última cena até cleanup.
- Start após término recria estado e SpawnSystem: score 0, HP máximo configurado, duração cheia, running, motivo null, mapas/cooldowns/IDs limpos e seed reiniciada.

**Por que foi feito dessa forma:** causa da morte decide pontos; remover entidade por si só não indica mérito do jogador. A remoção imediata evita duplicação sem event bus. Game coordena fim por tempo e derrota em um único método; sistemas não controlam navegação.

**Resultado/HUD futuros:** getState contém score final, HP, duração, tempo decorrido/restante e motivo. GameFinishReason usa time_expired/defeated; contratos antigos de Result/API ainda usam player_defeated. A futura integração precisará mapear defeated para player_defeated ou unificar contratos deliberadamente. Callbacks continuam scaffolding. UI poderá receber snapshots quando valores apresentados mudarem, sem possuir regras nem atualizar a 60 FPS. Não há contagem independente de inimigos derrotados; com recompensa padrão 1, score coincide com kills válidos, mas isso não vale para configurações customizadas.

**O que eu preciso entender:** código implementado pelo Codex; estudar atribuição de morte, união discriminada do evento, snapshot aninhado, ordem determinística, retorno antecipado e máquina de estados running/finished.

**Como testar manualmente:**

1. Start Game. Em DevTools/Sources, breakpoint em createInitialState: score 0, HP 100, duration/remaining 120, running e motivo null.
2. Breakpoint em CombatSystem.applyCollision. Usar Space ou Q/E contra cada tipo: dano não fatal mantém score; HP 50 → 25 → 0 soma exatamente 1. Vários impactos não somam novamente para o mesmo ID. HUD Score ainda mostra placeholder 0.
3. Reiniciar e deixar Chaser encostar: HP reduz 20, entidade some e score não muda. Para observar derrota rapidamente, no debugger ajustar HP para 1 antes de continuar; contato ou tiro inimigo deve produzir HP 0, finished/defeated.
4. Em finishMatch observar score/elapsed/remaining finais. Continuar, segurar W/Space/Q/E e esperar além do intervalo de spawn: cena e dados permanecem congelados, sem navegação automática.
5. Sair pelo botão existente e iniciar outra partida: HP 100, score 0, cronômetro completo, sem entidades antigas; primeiro spawn após intervalo configurado.
6. Para time-up rápido, no debugger ajustar remainingSeconds para 0.005 e elapsedSeconds para durationSeconds - 0.005. Sem golpe letal, o próximo update termina time_expired. Com golpe letal nesse último período termina defeated. Com remaining já zero, nenhum dano novo ocorre.

**Possíveis perguntas de entrevista:**

- Onde ficam pontos e por que React não calcula? “No GameState; a simulação conhece dano e morte. React apenas apresentará snapshots.”
- Como decide se uma morte pontua? “O inimigo estava vivo e recebeu o golpe fatal de projétil do jogador.”
- Por que contato vale zero? “O Chaser se autodestrói; isso não é uma eliminação por ataque do jogador.”
- Como impede duplicação? “Consumo a bala e removo o inimigo imediatamente; eventos seguintes não encontram um alvo vivo.”
- Como termina em HP zero? “Limito HP a zero e Game chama o mesmo finishMatch usado pelo timer.”
- E se tempo e derrota coincidem? “Processo dano no último período ativo antes do time-up; se o tempo já acabou ao entrar, não processo gameplay.”

**Validação realizada:** checks temporários de código, sem arquivos de teste, passaram para recompensas 1/1, dano não fatal, origem não jogadora, contato sem pontos/dano duplicado, mortes sem pontuação repetida, tiro/contato letal, HP zero, interrupção antes de projétil posterior, freeze por 600 updates incluindo internos do spawn, restart, ordem no deadline, timer de 120 s em 7200 ticks e snapshot customizado de recompensa. Renderer/RAF substituídos: isso não comprova integração visual ou lifecycle no browser. Typecheck, build e lint passaram pelo npm-cli instalado. O launcher npm permanece quebrado (problema preexistente). Build mantém aviso de chunk > 500 kB: principal 990,06 kB minificado. Nenhum erro de tipos ou lint.

**Limitações:** HUD e Result continuam desconectados; nenhum E2E, pausa, API, barras, efeitos ou som adicionado. Não houve validação manual no navegador. Há diferença de nomenclatura entre motivo da simulação e contrato antigo da UI/API. Renderização permanece ativa após fim.

### Etapa 13 — HUD e integração React

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Separação simulação/UI e estratégia de integração decididas em colaboração; código implementado pelo Codex.

**O que foi implementado:** HUD real de pontos, tempo MM:SS, HP atual/máximo e estado; barras oficiais sobre jogador e inimigos em Pixi; comandos de teclado visíveis; layout flexível do cabeçalho. Pontuação continua +1 por eliminação válida e +0 por contato.

**Requisitos originais e conflito:** INSTRUCOES.md exige vida acima do jogador e de cada inimigo, HUD com pontos/tempo e informação semântica de pontos/tempo/estado, sem anúncios por frame. O anexo exclui barras inimigas por padrão, mas manda priorizar o original em conflitos. Portanto foram implementadas barras sobre ambos, sem mudar gameplay. Original consultado antes da implementação; não foi necessário pedir confirmação novamente porque o usuário já autorizou seguir suas regras. Não significa implementar pausa, Result ou todos os requisitos restantes agora.

**Arquivos principais envolvidos:** GameHudSnapshot.ts (novo); Game.ts; GameCanvas.tsx; screens/Game.tsx; GameRenderer.ts; gameAssets.ts; este diário. App, GameLoop, GameState, configurações e regras de combate não foram alterados nesta etapa.

**Como funciona:**

- GameHudSnapshot contém somente health, maxHealth, score, remainingSeconds inteiro apresentado, status e finishReason. Sem Maps, posições, Game global ou referência mutável ao estado original. Object.freeze e readonly protegem a cópia de valores primitivos.
- Start publica imediatamente o snapshot real da configuração. Enquanto assets carregam, tela mostra placeholders e Loading, sem inventar HP ou duração. GameCanvas limpa a apresentação para null ao iniciar nova inicialização.
- Callback de update do GameLoop executa a simulação e depois publishHud, inclusive quando o update terminou cedo por derrota/time-up. publishHud compara todos os campos apresentados com o snapshot anterior. Mudança de posição ou fração de segundo não dispara callback. HP/pontos/status mudados são publicados no mesmo update.
- Timer usa ceil com tolerância de 1e-9 para resíduo numérico: 120 → 02:00, 65 → 01:05, 9 → 00:09, 0 → 00:00. Não altera remainingSeconds fracionário do GameState. Formatador somente apresenta o inteiro.
- GameCanvas encaminha via callback guardado em ref; efeito atualiza a ref sem reinicializar Pixi quando identidade do callback muda. Guard cancelled impede publicação por instância desmontada. setHud da tela é estável. Efeito de inicialização segue dependente da config, não do HUD.
- Status textual usa role=status; timer/HP/pontos permanecem texto sem região live, evitando anúncios a cada segundo. Cabeçalho quebra linhas e controles são texto em inglês.
- Pixi cria barra por ID numa camada acima do mundo. Frame e preenchimento oficiais usam máscara horizontal: HP reduz largura visível, sem comprimir arte. Geometria da máscara muda apenas se proporção mudar; posição acompanha cada frame. Barra não é filha do sprite girado; posição considera extensão máxima do navio e limita borda superior/laterais. Morte remove a barra junto com ID ausente; cleanup destrói containers, máscaras e sprites antes de texturas.
- Canvas mantém coordenadas lógicas da config, proporção e DPR; CSS reserva espaço para HUD/comandos. Nenhuma dimensão do HUD participa da simulação.
- Finished publica valores finais e preserva cena congelada. Novo start limpa comparação e publica valores iniciais; remount da tela começa com null. Nenhuma navegação Result foi ligada.

**Por que foi feito dessa forma:** GameState é a fonte verdadeira. HUD é apresentação de uma cópia; Pixi acompanha coordenadas contínuas e indicadores no mundo. Snapshot não inclui duração/elapsed por ainda não serem usados pelo HUD; permanecem no estado para futuro resultado.

**O que eu preciso entender:** código escrito pelo Codex nesta colaboração. Revisar estado autoritativo vs cópia, igualdade de campos, arredondamento visual, callbacks/ref e dependências do useEffect, cancelamento assíncrono em Strict Mode, máscara Pixi e cleanup de recursos.

**Como testar manualmente:**

1. Start Game: após carregar, HP 100 / 100, Score 0, Time 02:00 e Playing; barra verde sobre jogador. Durante loading não há valores antigos.
2. Esperar: Time reduz para 01:59 sem travar movimento. Redimensionar janela: cabeçalho quebra linhas e arena mantém proporção. Comando W/↑, A/←, D/→, Space, Q/E aparece abaixo.
3. Atirar num Chaser ou Shooter: primeiro dano reduz barra vermelha sem pontos; morte soma 1 e remove navio/barra.
4. Deixar Chaser encostar: HP reduz 20 e barra verde diminui; Score não aumenta. Bala de Shooter reduz HP 10.
5. Para acelerar derrota, breakpoint em Game.update e ajustar this.state.players.get('player').health = 1. Continuar até impacto: HP 0 / 100, Ship Destroyed e cena congelada; HUD preserva pontuação/tempo finais.
6. Para time-up rápido, breakpoint em Game.update, ajustar this.state.remainingSeconds = 0.005 e this.state.elapsedSeconds = this.state.durationSeconds - 0.005. Sem dano letal, continuar: Time 00:00, Time Expired e cena congelada.
7. Quit Match e Play Again: HUD volta a HP 100 / 100, Score 0, Time 02:00 e Playing, sem entidades anteriores. Quit ainda usa fluxo antigo de resultado placeholder; resultado real não faz parte desta etapa.
8. Em React DevTools Profiler, mover/rotacionar sem dano ou kills: posição não provoca renderizações contínuas da tela. Mudanças reais de HP/pontos podem naturalmente produzir updates próximos; não há limite artificial que esconderia dano.

**Possíveis perguntas de entrevista:**

- Onde fica o estado verdadeiro? “GameState guarda HP, score e timer; React guarda somente a cópia apresentada.”
- Como HUD recebe dados? “Game compara o snapshot após update e publica mudanças por callback; Canvas encaminha à tela.”
- Por que não 60 renders por segundo? “Coordenadas não vão ao React e frações do timer não mudam o segundo exibido.”
- Por que não compartilhar Maps? “São mutáveis e contêm dados que HUD não usa; compartilhar aumentaria acoplamento.”
- Como evita divergência? “React não soma pontos nem desconta tempo; apresenta valores enviados pelo jogo.”
- React e Pixi fazem o quê? “React apresenta HUD/telas; Pixi desenha mundo e barras sobre entidades.”

**Validação de código:** verificações temporárias passaram para snapshot inicial imutável, HP máximo/atual, score zero, duração configurada 65 s, 60 updates com apenas uma mudança de segundo, formatação 02:00/01:05/00:09/00:00, kill +1, dano não fatal sem pontos, contato sem pontos, HP por tiro/contato, derrota final HP zero, freeze sem callbacks extras, restart, time-up 00:00 e ausência de callback após destroy. Renderer/RAF substituídos; checks não garantem visual Pixi ou renders React no browser.

**Verificações adicionais:** renderer com objetos Pixi substituídos confirmou reutilização das barras, recorte proporcional para jogador/inimigo, posição sem rotação, preenchimento invisível em HP zero, remoção por ID e cleanup. Typecheck, build e lint passaram via npm-cli instalado; launcher npm quebrado é condição preexistente. Aviso preexistente de chunk > 500 kB permanece (principal 993,15 kB minificado).

**Limitações:** não executei teste manual no navegador ou E2E. Sem pausa, Result real, API, toque, efeitos ou sons. Barras usam escala fixa em coordenadas lógicas; em telas muito pequenas podem ficar pequenas. Layout segue o cabeçalho existente, sem reproduzir toda a composição da referência. Contrato futuro de Result ainda usa player_defeated, enquanto simulação usa defeated.

### Etapa 14 — Pausa completa

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Requisitos e arquitetura acordados com o usuário; implementação de código realizada pelo Codex.

**O que foi implementado:** Pause manual no cabeçalho, pausa automática por perda de foco e aba oculta, modal React com Resume explícito, descarte de input e retomada sem recuperar tempo pausado.

**Conformidade original:** INSTRUCOES.md foi lido antes de alterar código. Exige pausa manual/automática, suspensão de cronômetro/cooldowns/simulação e retomada por ação do jogador sem input acumulado. Nenhum conflito com este pedido; regras originais preservadas. Nenhum commit realizado.

**Arquivos principais envolvidos:** src/game/core/Game.ts; src/game/core/GameState.ts; src/game/input/InputManager.ts; src/components/GameCanvas.tsx; src/components/PauseDialog.tsx (novo); src/screens/Game.tsx; src/index.css; este diário. GameLoop e GameHudSnapshot foram reutilizados sem mudanças; sistemas de movimento, combate e spawn não foram modificados.

**Como funciona:**

- GameState acrescenta paused. pause só aceita running; muda status, desanexa/reset input, para GameLoop, desenha uma última cena e publica snapshot. Chamadas repetidas são inofensivas.
- Guard existente de Game.update só aceita running, portanto protege também contra avanço caso o método seja chamado com paused. Nenhum sistema ou countdown avança. GameLoop.stop cancela RAF; a cena já desenhada permanece no canvas sem exigir frames durante pausa.
- resume só aceita paused com documento visível e janela focada. Reanexa input vazio e usa GameLoop.start existente: lastTime = performance.now e accumulator = 0. Não há catch-up, rajada de spawn ou cooldown consumido pelo relógio real.
- Game registra window.blur e document.visibilitychange ao iniciar. Aba hidden pausa; eventos de focus/visible nunca retomam automaticamente. Se carregamento concluir em segundo plano, a partida inicia imediatamente pausada antes de simular. Listeners são removidos no término e destroy, usando referências estáveis.
- InputManager.detach remove keydown/keyup/blur e limpa todas as flags. Durante pausa não captura gameplay. Após Resume, keydown com repeat é ignorado, mas teclas de gameplay repetidas ainda têm preventDefault para não rolar a página. É necessário soltar e pressionar novamente uma tecla antiga; movimento/tiros contínuos continuam funcionando após um pressionamento novo, pois a flag fica true até keyup.
- GameCanvas expõe somente pause/resume via ref tipada e useImperativeHandle. A instância de Game permanece privada; React envia intenções e recebe confirmação no snapshot de status. gameRef é limpa no cleanup sem apagar outra instância iniciada depois. Callback HUD mantém guard cancelled; controles/estado da UI não reinicializam Pixi.
- Tela mostra Paused pelo mesmo snapshot, sem estado React independente de pausa. Pause fica desabilitado durante loading/fim. Modal usa dialog.showModal: fundo inerte, foco em Resume e contenção nativa de foco. Cleanup fecha e restaura foco; Escape/backdrop não retomam nem fecham a pausa. Resume por clique/Enter/Space é a ação explícita.
- Pausa não recria estado, entidades, seed, cooldowns ou pontos. start não reinicia uma partida pausada por acidente. Sair desmonta/destrói normalmente; iniciar outra partida usa reset existente. Partida finished não pode ser pausada ou retomada.

**Por que foi feito dessa forma:** o mesmo relógio controla todas as regras. Pausar no coordenador evita alterações em vários sistemas e mantém React como apresentação. Parar RAF reduz trabalho durante uma cena estática. Dialog nativo resolve foco sem biblioteca extra.

**O que eu preciso entender:** código implementado pelo Codex em colaboração. Estudar máquina de estados, tempo ativo vs relógio real, reset do acumulador, input sustentado vs key repeat, referências imperativas restritas, blur vs visibilitychange, cleanup assíncrono e dialog modal no Strict Mode.

**Como testar manualmente:**

1. Start Game, mover e disparar até haver inimigos/balas. Clicar Pause: modal Game Paused aparece com Resume focado; timer, HP, pontos e toda cena ficam parados. Esperar mais de um intervalo de spawn.
2. Pressionar W/Space/Q/E durante pausa, soltar e clicar Resume: nenhum movimento/tiro antigo deve acontecer. Pressionar novamente: controles normais voltam.
3. Manter W ou Space pressionado, mudar de janela e retornar sem soltar: modal permanece; após Resume, repetição antiga não reativa input. Soltar e pressionar novamente para jogar.
4. Durante partida ativa, Alt+Tab para outra janela e voltar: continua pausada até Resume. Repetir mudando de aba, minimizando e alternando hidden/visible.
5. Anotar timer/cooldown no debugger antes de pausar, esperar e retomar: somente tempo ativo posterior deve ser descontado. Projétil deve continuar da posição preservada; spawn deve respeitar restante do intervalo, sem rajada.
6. No modal, Tab permanece dentro; Escape não fecha nem retoma. Resume por teclado deve funcionar e devolver foco ao jogo/interface.
7. Repetir vários ciclos Pause/Resume e sair/reabrir partida: sem loops/listeners duplicados. Iniciar com carregamento de assets e imediatamente trocar aba: ao retornar deve exigir Resume.
8. Terminar por tempo ou derrota: Pause desabilitado; alternar aba não muda motivo final nem reativa simulação. Reiniciar pela navegação existente restaura HUD/entidades como antes.

**Possíveis perguntas de entrevista:**

- O que pausa realmente? “Game para o loop; sem updates, tempo, cooldowns, projéteis, inimigos e spawn não avançam.”
- Como evita recuperar tempo parado? “Ao retomar, start redefine lastTime e limpa acumulador, mantendo o estado da partida.”
- Quem possui paused? “GameState. React recebe o status no snapshot e envia somente intenções.”
- Por que voltar à aba não retoma? “Listeners apenas chamam pause; resume é chamado pelo botão explícito.”
- Como evita tecla presa? “Detach limpa flags e remove listeners; após Resume ignoro repeat até um novo pressionamento.”
- Como evita duplicação no Strict Mode? “Refs são privadas, listeners têm cleanup e inicialização cancelada não publica snapshots.”

**Validação:** revisão de código confirmou guard central, stop/start do loop com reset existente, detach/reset do input, listeners simétricos e bridge de snapshot. Typecheck, lint e build passaram pelo npm-cli instalado. Launcher npm quebrado é condição preexistente; build mantém aviso de chunk > 500 kB (principal 995,23 kB minificado). Não foram adicionados ou executados testes E2E; teste manual será realizado pelo usuário.

**Limitações:** pausa manual pelo botão, sem novo atalho. Modal simples acompanha o estilo existente; não reproduz integralmente a arte sample_pause. Browser deve suportar dialog.showModal (navegadores modernos). Nenhum teste manual de navegador executado nesta tarefa. Result/API continuam fora desta etapa; o fluxo Quit existente permanece.

### Etapa 15 — Assets oficiais e semântica do HUD

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Escopo e arquitetura definidos com o usuário; implementação feita pelo Codex.

**O que foi implementado:** painel oficial e ícones de vida/pontos/tempo no HUD React; valores em lista de descrição semântica; legenda estruturada de controles reais fora da arena.

**Conformidade original:** INSTRUCOES.md foi lido primeiro. Exige assets fornecidos, comandos apresentados, pontos/tempo/estado em interface semântica e ausência de anúncios por frame. Nenhum conflito encontrado. Não foram introduzidos bindings, regras ou requisitos de gameplay adicionais. Nenhum commit realizado.

**Arquivos principais envolvidos:** src/game/assets/hudAssets.ts (novo); src/screens/Game.tsx; src/index.css; este diário.

**Como funciona:**

- HUD_ASSET_MANIFEST centraliza counter_panel.png, icon_heart.png, icon_score.png e icon_time.png, inspecionados junto do atlas oficial. São decoração DOM carregada nativamente por img; não precisam virar texturas Pixi nem fazer parte do carregamento obrigatório do mundo. O loader existente de água/navios/barras continua igual.
- Imagens têm alt vazio para não duplicar rótulos. Se decoração falhar, onError oculta a imagem; texto e fundo CSS permanecem disponíveis sem bloquear gameplay. Não há listeners globais, novos timers ou efeitos de inicialização.
- section Match information contém dl; dt identifica Health (HP), Score, Remaining time e Match state; dd contém os valores do mesmo snapshot. A própria apresentação visível é semântica, sem segunda cópia de dados ou dependência do canvas.
- Somente dd do estado tem role=status/aria-atomic. Leitor de tela pode consultar vida/pontos/tempo, mas alterações desses valores não são anúncios automáticos. O status só muda em loading/playing/paused/fim, nunca por frame.
- PublishHud e o snapshot existentes não foram alterados: React recebe apenas mudanças de campos apresentados, não posições ou frações do timer. Formato MM:SS e regras de pontuação permanecem.
- Keyboard controls usa heading, ul/li e kbd: W/Arrow Up avança; A/Arrow Left gira à esquerda; D/Arrow Right gira à direita; Space dispara frontal; Q/E disparam salvas à esquerda/direita. Setas têm nome acessível. Valores conferidos no InputManager; nenhuma nova associação foi criada.
- Painéis ficam no cabeçalho e legenda abaixo do canvas, sem cobrir arena. Flex wrap acomoda largura disponível; tamanho lógico da simulação não depende desses elementos.

**Por que foi feito dessa forma:** usa arte oficial sem alterar regras ou resources Pixi. Um único DOM visível atende leitura visual e assistiva, evitando divergência. Legenda descreve comandos implementados e não sugere controles de toque ainda ausentes.

**O que eu preciso entender:** código escrito pelo Codex nesta colaboração. Revisar dl/dt/dd, alt decorativo, live regions limitadas, estado autoritativo/snapshot e diferença entre imagem DOM e textura Pixi.

**Como testar manualmente:**

1. Start Game: conferir painel/ícones oficiais, HP 100 / 100, Score 0, Time 02:00 e Playing. Redimensionar: cabeçalho e legenda quebram linhas sem sobrepor a arena.
2. Conferir cada tecla da legenda jogando: W/↑, A/←, D/→, Space, Q e E. Movimento e tiros podem ser usados juntos.
3. Receber dano, eliminar inimigo e deixar Chaser encostar: HP/pontos mostram regras existentes; contato não soma pontos. Timer MM:SS continua real.
4. Pausar manualmente/trocar aba: status Paused, valores congelados e modal existente. Resume explícito retoma; no fim valores finais são preservados. Nova partida restaura valores.
5. No painel Accessibility do navegador ou leitor de tela, localizar Match information e pares de rótulo/valor; navegar até Keyboard controls. Ícones não devem ter nomes duplicados. Timer não deve ser anunciado a cada segundo; somente status é live.
6. Bloquear uma imagem decorativa pelo DevTools/Network e recarregar: texto continua legível, sem impedir arena. O loader de assets Pixi mantém tratamento de falhas próprio.

**Possíveis perguntas de entrevista:**

- Por que informação fora do canvas? “Canvas não oferece esses pares semânticos; o DOM apresenta os mesmos valores a tecnologias assistivas.”
- Como evita anúncios frequentes? “HP/score/timer não têm live region; somente mudanças de estado são anunciadas.”
- Por que ícones usam alt vazio? “São decorativos; os rótulos de texto já identificam cada valor.”
- Como evita divergência? “O HUD visual e semântico são o mesmo DOM alimentado pelo snapshot da simulação.”
- Por que não carregar ícones com Pixi? “Esses ícones pertencem ao DOM React; navegador carrega imagens, sem textura ou cleanup Pixi extra.”

**Validação:** typecheck, lint e build passaram via npm-cli instalado. Launcher npm quebrado é preexistente. Build mantém aviso de chunk > 500 kB: principal 996,49 kB minificado. Revisão conferiu comandos no InputManager e preservação da bridge/sistemas. Não foram criados ou executados testes E2E; validação manual será feita pelo usuário.

**Limitações:** sem teste manual no navegador/leitor de tela nesta tarefa. Painéis seguem cabeçalho existente, sem reprodução integral da referência. Em viewports pequenos o conteúdo pode exigir rolagem, mantendo a arena em proporção; controles de toque continuam fora deste marco. Result/API permanecem pendentes.

### Etapa 16 — Options funcional e persistente

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Requisitos e estratégia acordados com o usuário; código implementado pelo Codex.

**O que foi implementado:** formulário em inglês com Game session time e Enemy spawn time, Save explícito, validação acessível, persistência local e aplicação real às novas partidas.

**Conformidade original:** INSTRUCOES.md lido antes da implementação. Duração 60–180 s, intervalo positivo com limites documentados, persistência após refresh e snapshot por partida foram respeitados. Nenhum conflito encontrado; nenhum commit realizado. Placeholders de áudio/dificuldade/fullscreen foram removidos da tela porque não tinham integração e não eram as duas opções exigidas; nenhuma mecânica correspondente foi alterada.

**Arquivos principais envolvidos:** src/config/gameConfig.ts; src/config/gameOptions.ts (novo); src/screens/Options.tsx; src/screens/Game.tsx; src/index.css; este diário. App, Result, GameCanvas, Game core e SpawnSystem não precisaram de alterações.

**Como funciona:**

- Game session time aceita número finito entre 60 e 180 s inclusive. Enemy spawn time aceita número finito entre 1 e 15 s inclusive. Campos vazios, NaN, infinito, negativos e valores fora de faixa são rejeitados; frações são aceitas porque a simulação usa segundos fracionários (step=any), sem requisito original de inteiros.
- ENEMY_SPAWN_INTERVAL_LIMITS fica junto de SESSION_DURATION_LIMITS no GameConfig. Limite 1 evita mais de uma tentativa por segundo (até 180 em três minutos), moderando densidade sem alterar regras. Máximo 15 permite quatro tentativas na partida mínima de 60 s. Padrão 3 s está no intervalo. Esses números não garantem spawn bem-sucedido ou quota de cada tipo: posições continuam validadas e distribuição continua probabilística existente.
- GameOptions é subconjunto tipado do GameConfig; defaults são extraídos de DEFAULT_GAME_CONFIG, sem duplicar parâmetros. validateGameOptions é reutilizado no formulário e antes de salvar; leitura usa as mesmas faixas. Os limites governam opções salvas; validação interna de SpawnSystem continua exigindo intervalo positivo, sem mudar comportamento de simulação para configurações programáticas.
- Draft usa strings para permitir editar/apagar campos sem converter imediatamente para zero. Save transforma valores em números e valida ambos antes de gravar. noValidate permite mensagens próprias; required/min/max continuam descrevendo restrições dos inputs. Erro liga aria-invalid/aria-describedby, role=alert e foco no primeiro campo inválido.
- Chave localStorage pirate-battle:options:v1 guarda JSON com version:1 e apenas sessionDuration/enemySpawnInterval. A gravação acontece somente em Save. Back descarta alterações não salvas. Mensagem Settings saved informa que valores valem para novas partidas; editar limpa confirmação antiga.
- loadGameOptions valida unknown: ausência, JSON corrompido, null/array/tipo incorreto, versão desconhecida ou acesso negado usam defaults 120/3. Em objeto v1 reconhecido, cada campo inválido volta ao próprio default e campo válido é preservado. Strings numéricas não são aceitas como números persistidos; campos extras são ignorados. Dados ruins não são escritos durante leitura.
- Se setItem falha (quota/permissão), aparece erro e nenhum sucesso é indicado; opções anteriores não são substituídas. Se storage não está acessível, novas partidas continuam com defaults. Não existe fallback persistente alternativo nem promessa falsa de salvar após refresh.
- Na montagem da tela Game, lazy useState lê opções e combina com DEFAULT_GAME_CONFIG uma única vez. Essa referência estável entra em GameCanvas.config; updates do HUD não mudam a config nem reinicializam Pixi. Game.start já copia os objetos aninhados e entrega snapshot ao SpawnSystem. Não se consulta storage durante os frames, pause ou resume.
- Main Menu → Start e Result → Play Again navegam para Game e montam tela nova, capturando opções salvas atuais. O fluxo existente desmonta a partida ao sair; não há restart ativo na mesma tela. Strict Mode pode repetir leitura pura/inicialização em desenvolvimento, sem gravação ou alteração de opções. Modificar storage em outra aba durante partida não altera snapshot ativo; a próxima montagem lê valores novos.

**Por que foi feito dessa forma:** preserva fluxo atual e mantém configuração tipada única. Persistência é fronteira de dados não confiáveis; validar impede crash na partida. Draft não é configuração ativa: somente Save grava, e somente nova partida captura valores.

**O que eu preciso entender:** código feito pelo Codex em colaboração. Revisar Pick, unknown/narrowing, validação de números finitos, strings de formulário, localStorage síncrono com try/catch, versão de schema, lazy useState, identidade de config e snapshot em duas etapas (tela e simulação).

**Como testar manualmente:**

1. Options: conferir defaults 120 e 3; salvar 60 e 5. Ver mensagem de sucesso, voltar ao menu e iniciar: HUD começa 01:00 e primeira tentativa de spawn ocorre após 5 s ativos.
2. Refresh, abrir Options: valores 60/5 permanecem. Salvar 180/1 e iniciar outra: HUD 03:00 e tentativas a cada 1 s. Confirmar 15 s como máximo permitido.
3. Save com duração vazia/59/181 ou spawn vazio/0/negativo/0.5/16: mensagem por campo, foco no primeiro erro, nenhuma gravação. Testar duração 60/180 e spawn 1/15; fração válida como 2.5 deve funcionar.
4. Editar sem Save e clicar Back; reabrir: valores salvos anteriores continuam. Tab e Enter navegam/submetem formulário; foco dos inputs e botões é visível.
5. DevTools/Application: chave pirate-battle:options:v1. Testar JSON inválido, null, array, version diferente ou valores do tipo string/out of range; refresh e Start não devem quebrar. Campo v1 válido permanece, campo inválido usa default. Remover chave restaura 120/3.
6. Enquanto jogo está ativo, alterar chave via DevTools/outra aba: duração/intervalo da partida atual não mudam. Ao entrar novamente/Play Again, valores salvos novos passam a valer.
7. Pause/Resume preserva duração e intervalo restantes, sem reler opções. Após fim ou Quit, Play Again usa nova montagem e reset existente de HP, score, timer e entidades.
8. Simular bloqueio de storage/quota: Save deve avisar erro sem sucesso; leitura inacessível não deve impedir partida com defaults.

**Possíveis perguntas de entrevista:**

- Onde ficam defaults e opções? “Defaults no GameConfig; salvo apenas Pick das duas opções numa chave versionada.”
- Por que draft é string? “Permite campo vazio durante edição; converto e valido só ao salvar.”
- E JSON corrompido? “Leitura usa try/catch e valida tipos/faixas; dados ruins viram defaults seguros.”
- Por que não atualizar partida ativa? “Balanceamento é snapshot do start; opções novas valem para outra partida.”
- Quando Play Again lê opções? “Ao montar novamente a tela Game, antes de inicializar o canvas e o Game.”
- Por que 1–15 segundos? “Limita densidade e mantém oportunidades de spawn mesmo numa sessão de 60 segundos; o padrão 3 permanece.”

**Validação:** revisão conferiu fluxo Menu/Result → montagem Game, config estável, snapshot existente, validação de formulário/storage e fallback. Typecheck, lint e build passaram via npm-cli instalado. Launcher npm quebrado é preexistente; build mantém aviso de chunk > 500 kB (principal 998,63 kB minificado). Nenhum teste manual de navegador ou E2E executado nesta tarefa.

**Limitações:** se armazenamento local for bloqueado, Save falha explicitamente e leitura usa defaults. Sem sincronização visual automática de Options entre abas; reabrir lê dados atuais. Configuração exposta somente para duração/intervalo; não altera probabilidades ou outros parâmetros. Resultado real/API continuam pendentes.

### Etapa 17 — Result e fluxo local de partida concluída

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Requisitos e estratégia definidos com o usuário; implementação realizada pelo Codex.

**O que foi implementado:** resultado real após time-up/derrota, contrato CompletedMatch, registro local da última conclusão, restauração no refresh de Result, distinção de abandono e status honesto de registro ainda não enviado.

**Conformidade original:** INSTRUCOES.md foi lido antes das alterações. Resultado tem pontos, tempo ativo, motivo, situação de registro e ações Play Again/Main Menu. Última conclusão persiste; abandono não vira resultado nem substitui a conclusão anterior. Sem conflito e sem commit. API completa permanece para etapa posterior, conforme pedido incremental.

**Arquivos principais envolvidos:** types/completedMatch.ts e storage/completedMatchStorage.ts (novos); game/core/Game.ts; game/core/GameState.ts; game/systems/CombatSystem.ts; components/GameCanvas.tsx; screens/Game.tsx; screens/Result.tsx; app/App.tsx; app/navigationTypes.ts; screens/MatchHistory.tsx; este diário.

**Como funciona:**

- CompletedMatch contém matchId UUID, completedAt ISO, score, enemiesDefeated, elapsedSeconds, endReason time_expired/player_defeated, playerHealth, config completo e registrationStatus not_submitted. Não admite quit. GameResultPayload agora aponta para esse contrato, sem bundle de valores fictícios.
- GameState mantém contador de eliminações separado de score. CombatSystem incrementa ambos somente no golpe fatal de projétil do jogador; recompensa não mudou. Isso permite contar kills mesmo se os pontos forem ajustados via configuração. Contato e remoção não pontuam nem contam kills.
- finishMatch mantém guard running, grava finished/motivo e remove input/listeners de pausa antes de emitir onMatchComplete uma única vez. Config é copiada e congelada, incluindo objetos aninhados atuais; resultado também é congelado. Não envia GameState/Maps à UI.
- Simulação usa defeated; contrato externo usa player_defeated, com conversão explícita em Game. React apresenta o motivo recebido sem inferir pela vida/pontos. Labels Time Expired/Ship Destroyed.
- elapsedSeconds já vem dos deltas de simulação ativos; pausa não conta. Time-up usa duração configurada exata; morte conserva tempo acumulado até o subpasso letal. Tela arredonda somente a apresentação a até duas casas de segundos; storage guarda precisão original.
- Canvas encaminha callback por ref estável com guard cancelled. Tela Game navega com payload; App guarda resultado em memória, tenta persistir e mostra Result. Cleanup de Canvas destrói Game/Pixi/texturas/listeners como antes. Sem callback em destroy e sem novos updates React por frame.
- Chave pirate-battle:last-completed-match:v1 guarda version:1/result. Leitura usa unknown, valida forma completa da config (incluindo objetos aninhados e números finitos não negativos), campos de resultado, datas, motivo permitido e coerência de tempo/HP. Time-up deve ter elapsed igual à duração; derrota exige HP zero. Valores inválidos não são completados com defaults, pois isso inventaria uma partida.
- Ausência/JSON corrompido/versão desconhecida/dados inválidos/acesso negado retornam undefined; Result mostra No completed match is available. Falha de gravação não impede exibir resultado atual em memória, mas alerta que ele não sobreviverá ao refresh. Resultado anterior salvo continua intacto se escrita falhar.
- App usa #result somente para restaurar essa tela no refresh, sem biblioteca de roteamento ou persistência de partida ativa. Outras navegações removem marcador; refresh durante combate abandona partida e volta ao menu. replaceState não implementa pilha completa de Back/Forward ou sincronização de hash editado durante sessão; não foi acrescentado router.
- Quit agora navega ao Main Menu, sem resultado, persistência ou envio. Desmontagem/reload apenas liberam recursos da partida; completion é emitida somente por finishMatch. Assim abandono nunca substitui último CompletedMatch nem produz candidato de envio futuro.
- Play Again remonta Game, lê Options atuais uma vez e cria Game/Pixi/estado/SpawnSystem novos. Não reutiliza config do resultado. Main Menu apenas navega e não cria partida.
- Result mostra Not submitted yet e informa que nenhuma requisição de ranking/history foi feita. Não há retry/outbox/sucesso de servidor fictício. UUID/data/config preparam a próxima integração; identidade do jogador e ampliação dos contratos HTTP atuais ainda precisarão ser definidos. Hooks/API/MSW foram inspecionados e não chamados.
- MatchHistory recebeu somente ajuste de tipos: seu motivo vem do domínio (inclui quit para fixtures antigas), não do contrato de conclusão. Comportamento e APIs de histórico permaneceram iguais.

**Por que foi feito dessa forma:** conclusão pertence à simulação e abandono ao descarte do recurso, com caminhos separados. Persistência local não equivale a registro remoto. Guard do finish e callback único evitam duplicação sem event bus. Snapshot final desacopla UI de estado contínuo.

**O que eu preciso entender:** implementação pelo Codex em colaboração. Revisar contrato sem quit, callback único, conversão de motivo, precisão temporal, configuração copiada/congelada, validação de JSON, URL mínima para refresh e diferença entre salvar localmente e registrar em API.

**Como testar manualmente:**

1. Concluir por morte: Result deve mostrar score real, kills válidos, HP final no payload, Ship Destroyed e tempo ativo anterior à morte. Pausar por vários segundos durante a partida não deve aumentar Active Time Played.
2. Concluir por tempo: salvar duração 60 em Options, jogar ou acelerar remaining no debugger; Result Time Expired mostra 60 s ativos e configuração daquela partida, não opções posteriores.
3. Conferir Registration: Not submitted yet; Network não deve ter POST /api/matches disparado pela conclusão.
4. Refresh em Result (#result): mesmos ID/data/pontos/tempo/config são restaurados. Inspecionar chave pirate-battle:last-completed-match:v1.
5. Play Again: HUD limpo (HP máximo/score zero/tempo cheio), entidades novas. Alterar Options antes da nova partida: usar valores novos; resultado anterior mantém sua config antiga.
6. Main Menu: apenas menu, sem novo loop. Iniciar partida e Quit: menu, sem Result falso e sem substituir chave da última conclusão. Repetir refresh durante combate: menu e último resultado preservado; visitar #result com refresh para conferi-lo.
7. Corromper JSON, remover chave, usar endReason quit/versão desconhecida/config incompleta/tempo incoerente; carregar #result: estado vazio seguro, sem inventar score zero como partida concluída.
8. Bloquear localStorage: resultado atual ainda aparece com aviso de falha; nenhuma confirmação de registro remoto. Repetir ciclos iniciar/concluir/Play Again e verificar limpeza/ausência de duplicações.

**Possíveis perguntas de entrevista:**

- Quem decide o resultado? “Game encerra a simulação e emite um snapshot final; React só navega e apresenta.”
- Pausa conta no tempo? “Não; elapsed é acumulado pela simulação ativa, sem relógio externo.”
- Como distingue abandono? “Quit/unmount não chamam completion; só derrota ou time-up geram CompletedMatch.”
- Salvar localmente significa registrado? “Não. Status not_submitted informa que ainda falta envio HTTP.”
- Como evita resultado repetido? “finishMatch só aceita running; depois de finished não emite novamente.”
- Por que não usar config do último resultado no Play Again? “Nova partida deve capturar Options atuais; resultado é registro da config antiga.”

**Validação:** revisão de fluxo/código; typecheck, lint e build passaram pelo npm-cli instalado. Launcher npm quebrado é preexistente. Build mantém aviso de chunk > 500 kB: principal 1.001,78 kB minificado. Nenhum teste manual de navegador ou E2E executado nesta tarefa.

**Limitações:** somente última conclusão persistida, sem fila de envios nem player identity/API nova. Storage inacessível impede restauração após refresh e é sinalizado. Navegação continua local com marcador #result, sem router completo. Result usa estilo existente, sem redesign integral de assets. Validação de config confere campos numéricos/forma e coerência básica; resultado persistido nunca é usado para iniciar gameplay. Futuro contrato remoto ainda precisa incluir identidade/config/idempotência; fixture antiga de quit não foi enviada por este fluxo.

### Etapa 18 — Envio de conclusão e histórico pela API (caminho de sucesso)

**Status:** Concluído

**Responsável pela implementação:** Colaborativo. Escopo/arquitetura definidos com o usuário; código feito pelo Codex. mockServiceWorker.js é arquivo oficial gerado pelo MSW instalado, copiado sem edição manual.

**O que foi implementado:** conclusão → mutation TanStack Query → Axios → POST MSW → registro confirmado em memória → GET histórico → tela Match History. Result apresenta submitting/submitted/failed reais da requisição.

**Conformidade original:** INSTRUCOES.md lido antes de implementar. Stack original, contrato completo, envio apenas de conclusão e falhas sem bloquear gameplay foram preservados. Esta etapa incremental implementa sucesso/básico; persistência de pendências/confirmados, retries avançados, cenários de falha e ranking completo continuam para próximas etapas conforme pedido. Não há alegação de que os requisitos originais restantes já estejam concluídos. Nenhum commit realizado.

**Arquivos principais envolvidos:** api/matchContracts.ts, config/localPlayer.ts, mocks/matchHistoryState.ts e public/mockServiceWorker.js (novos); api/endpoints.ts; hooks/useApi.ts; mocks/handlers.ts; mocks/fixtures.ts; types/domain.ts; storage/completedMatchStorage.ts; app/App.tsx; screens/Result.tsx; screens/MatchHistory.tsx; main.tsx; este diário.

**Como funciona:**

- MatchHistoryRecord deriva de CompletedMatch, substitui elapsedSeconds por durationSeconds e acrescenta playerId/playerName. Mantém matchId, completedAt, score, kills, motivo (sem quit), HP final e config completo. SubmitMatchRequest usa esse mesmo DTO; retorno do POST é registro confirmado. Tipos antigos MatchResult/MatchHistoryEntry incompatíveis foram removidos do domínio, sem duplicar os mesmos dados com nomes divergentes.
- toSubmitMatchRequest faz a conversão de tempo e identidade na fronteira HTTP. LOCAL_PLAYER usa id local-player/name Captain, determinísticos; projeto não tinha identificação local reutilizável no histórico. Não é login/autenticação. Histórico sempre consulta esse playerId.
- App já recebe completion única do Game. Após salvar resultado local, chama useSubmitMatch.mutate uma vez no evento de conclusão, sem effect que repetiria em Strict Mode. Abandono nunca passa por esse caminho. Refresh/restauração do último resultado não dispara POST automático.
- Hook mutation configura retry:false e lifecycle. onMutate grava submitting; onSuccess recebe confirmação real, grava submitted/record e invalida history e ranking; onError grava failed. Status fica em cache TanStack Query por matchId. Result observa cache com query desabilitada para rede, sem polling ou state duplicado da resposta. App permanece montado ao Play Again, permitindo request terminar sem prender gameplay.
- CompletedMatch.registrationStatus not_submitted continua marcador inicial do artefato local imutável; não representa confirmação posterior. Status remoto real vive no cache MatchRegistration, omitido do DTO de envio. Não há confirmação remota persistida nesta etapa.
- Axios mantém base /api, JSON e timeout 10 s. POST /matches usa payload real; React não chama Map do mock. MSW aplica validação de identificação e reutiliza guard puro de CompletedMatch exportado pelo módulo de storage, sem acessar localStorage no handler. Payload quit/JSON inválido/incoerente é rejeitado com 400.
- matchHistoryState guarda Map de confirmados separado das fixtures; chave é matchId UUID produzido pelo jogo. ID existente devolve o mesmo registro sem duplicar. É uma proteção básica de identidade, não protocolo completo de idempotência/timeout/recovery. Fixture IDs têm prefixo fixture-match para não colidir com novas partidas.
- GET /history filtra playerId, ordena por data decrescente e desempata por ID, então pagina com parâmetros numéricos normalizados. Fixture de abandono antiga foi removida; fixtures locais têm score igual a kills e configuração válida. Ranking segue fixtures antigas e não é atualizado com partidas nesta etapa.
- useHistory refetchOnMount=always atualiza ao abrir a tela, mesmo se cache ainda fresco. Success invalida prefixo history, inclusive consultas inativas, que refazem ao montar. Não há sincronização manual de arrays em React.
- Match History mostra date, score, kills, duração ativa com até duas casas, motivo e details com jogador/ID/session/spawn. Config completo permanece no DTO/cache. Loading e atualização de fundo usam status; erro básico usa alert; lista vazia tem mensagem; tabela pode rolar horizontalmente.
- MSW instalado é 3.0.2: start usa onUnhandledFrame:bypass conforme tipos locais, sem opção antiga onUnhandledRequest. public/mockServiceWorker.js faltava; foi copiado da distribuição instalada. Bootstrap passa a iniciar worker em desenvolvimento e build como exige o original. Falha de startup é tratada sem impedir acesso ao app; API então pode falhar e exibir estado básico.

**Por que foi feito dessa forma:** reaproveita HTTP/query existentes e mantém simulação sem rede. Status depende da confirmação HTTP; mock realmente guarda registro para próxima consulta. Map por ID e DTO comum simplificam próximas etapas, sem implantar outbox ou sistema de autenticação.

**O que eu preciso entender:** código escrito pelo Codex em colaboração. Estudar mutation callbacks, query keys/invalidation, dados cacheados vs simulation snapshots, DTO na fronteira HTTP, mock na rede, diferença entre status local inicial e confirmação remota, identidade fixa e limites de estado em memória.

**Como testar manualmente:**

1. Iniciar pelo servidor Vite/build servido em localhost; conferir Service Worker ativo. Concluir partida por tempo/morte: Network deve mostrar exatamente um POST /api/matches, seguido de Result Submitting → Submitted após resposta.
2. Conferir payload/retorno: mesmo matchId, playerId local-player, Captain, score real, kills, completedAt, durationSeconds sem pausa, motivo e config usada. Nenhuma atribuição de Submitted antes de sucesso.
3. Abrir Match History pelo menu: GET /api/history inclui playerId/page/pageSize e retorna nova partida junto de fixtures. Detalhes mostram ID/config; maior data aparece primeiro.
4. Sair/voltar ao histórico: refetch ocorre; concluir outra partida enquanto cache antigo existe e abrir histórico novamente: novo registro aparece sem duplicação.
5. Play Again antes de resposta terminar: partida nova funciona normalmente; registro anterior pode concluir no cache por seu próprio ID. Pause/HUD/Options continuam iguais.
6. Quit/reload durante combate: nenhum POST de abandono; última conclusão local não é substituída. API também rejeita quit caso recebido por request manual.
7. Simular falha básica pelo navegador offline antes de concluir: status failed, sem bloquear Play Again/Menu. Não há retry automático da mutation; recuperar/enviar pendência é etapa futura.
8. Empty state pode ser conferido consultando GET com playerId sem registros; nenhum seletor de cenários foi adicionado. Verificar error/loading/background nas ferramentas de rede sem testes E2E.
9. Refresh: conclusão local continua em Result, mas cache/status de envio e registros novos do mock em memória são reiniciados. Label Not submitted in this session não afirma registro persistido nem reenvia automaticamente. Persistência remota/pendência é requisito futuro.

**Possíveis perguntas de entrevista:**

- Quem envia a partida? “App recebe completion; mutation Query usa Axios, que passa pelo endpoint MSW.”
- Por que mock não é chamado pelo React? “MSW intercepta HTTP; cliente usa a mesma fronteira que usaria com servidor.”
- Como histórico vê dados novos? “POST guarda no mock e invalido cache; GET consulta os confirmados e ao abrir a tela refaz a consulta.”
- Quando mostra Submitted? “Só no onSuccess após confirmação da API, nunca ao criar resultado local.”
- Como evita abandono? “Somente callback de conclusão chama mutation; DTO/validação não aceitam quit.”
- Quem identifica jogador? “Uma identidade local fixa, suficiente para demo single-player, sem autenticação.”

**Validação:** primeira verificação apontou tipagem do updater da união de status e opção antiga de MSW; ambas corrigidas com APIs/tipos instalados. Typecheck, lint e build finais passaram pelo npm-cli instalado. Launcher npm quebrado é preexistente. Aviso preexistente de chunk > 500 kB permanece (principal 1.006,19 kB minificado). Não foram executados testes de navegador/E2E nesta tarefa.

**Limitações intencionais:** confirmados e status remoto só em memória; refresh reinicia esse estado. Sem pendências persistidas, reenvio manual/automático, recovery após timeout de POST, protocolo completo de idempotência, proteção avançada de respostas fora de ordem, cenários MSW configuráveis ou ranking dinâmico. Histórico mostra primeira página de 20 registros; controles completos de paginação ficam para etapa própria. Requisito original de registro consistente/persistente nas duas abas ainda não está concluído.

### Etapa 19 — Ranking pela API e paginação básica

**Status:** Concluído

**Responsável pela implementação:** Colaborativo — código pelo Codex; requisitos e decisões em colaboração com o usuário.

**O que foi implementado:** ranking por partida, filtragem por configuração completa, ordenação determinística, fixtures coerentes com pontuação de 1 por eliminação, cinco resultados por página, navegação Previous/Next e estados loading/vazio/erro/atualização em segundo plano.

**Arquivos principais envolvidos:** `src/config/gameConfigKey.ts`, `src/api/rankingContracts.ts`, `src/api/endpoints.ts`, `src/hooks/useApi.ts`, `src/types/domain.ts`, `src/mocks/fixtures.ts`, `src/mocks/matchHistoryState.ts`, `src/mocks/handlers.ts`, `src/components/PaginationControls.tsx`, `src/screens/Ranking.tsx`.

**Como funciona:** React → useRanking → Axios GET /api/ranking → MSW → mesma coleção usada no histórico. Fixtures locais, oito jogadores externos e Map de confirmados são combinados por matchId. POST recupera IDs já existentes; ranking não cria um segundo registro. Filtra, ordena, calcula posição global e só depois pagina. Contrato compartilhado retorna items/page/pageSize/total/totalPages. Componente de paginação está preparado para uso futuro no histórico, cuja UI não foi alterada.

**Por que foi feito dessa forma:** INSTRUCOES.md exige uma entrada por partida e mesma configuração. O antigo scaffold agregava highScore/matchesPlayed e não atendia essa regra. Segui as instruções originais, conforme autorização anterior do usuário; gameplay, submissão e abandono foram preservados. Sem commit.

**Compatibilidade:** todos os campos de GameConfig participam: arenaWidth/arenaHeight; playerBoundaryPadding/enemyBoundaryPadding/playerCollisionRadius/islandCollisionRadius; sessionDuration/enemySpawnInterval; enemySpawnWeights/enemyKillRewards (chaser/shooter); enemySpawnMinimumDistance/enemySpawnMaxAttempts/enemySpawnMargin/enemySpawnSeed; playerHealth/playerMovementSpeed/playerRotationSpeed; projectileSpeed/projectileDamage/projectileLifetime/projectileCollisionRadius; frontShotOffset/broadsideOffset/broadsideProjectileCount/broadsideSpacing; weaponCooldowns (primary/secondary); todos os campos de chaser e shooter, incluindo vida, velocidades, dano, colisão, cooldown, projéteis e alcance. Assim também diferenças de dificuldade alteram a chave. A tela captura defaults + opções salvas ao abrir, mostra duração/spawn e informa que todos os parâmetros devem coincidir. Não permite consultar configurações antigas nesta etapa.

**Desempate exato:** score decrescente → durationSeconds crescente → completedAt crescente (data mais antiga primeiro) → matchId crescente por comparação de strings, sem depender de locale. Menor duração privilegia a mesma pontuação obtida em menos tempo ativo. IDs únicos concluem a ordem; não há ranking agregado por jogador.

**Cache:** query key inclui configKey/page/pageSize. Sucesso do envio já invalida todas as queries de ranking e histórico; useRanking agora refaz a consulta em cada montagem, mesmo com cache recente. Dados de configurações ou páginas distintas não compartilham a mesma chave. Nenhum dado remoto é copiado para estado React.

**O que eu preciso entender:** JSON canônico, ordenação com desempates, posição calculada antes de slice, identidade de queries, diferença entre configuração salva e snapshot histórico. Código feito com auxílio do Codex: estudar antes de explicar em entrevista.

**Como testar manualmente:** abrir ranking com opções padrão (11 fixtures, três páginas); navegar e conferir posições contínuas; concluir uma partida, verificar Submitted, histórico e ranking do Captain; reabrir ranking e conferir atualização; salvar opções diferentes e verificar lista vazia até concluir partida compatível; abandonar combate e conferir ausência de novo registro. Reabrir após refresh restaura somente fixtures, pois confirmados ainda vivem em memória.

**Possíveis perguntas de entrevista:**

- Por que não comparar só duração? “Armas, spawn e dificuldade também alteram a chance de pontuar.”
- Por que calcular rank antes de paginar? “A posição é global; a segunda página não deve começar de novo em 1.”
- Por que não adicionar manualmente o resultado no React? “A API é a fonte dos confirmados; invalido o cache e consulto de novo.”
- Como evitar duplicação entre abas? “As duas consultam os mesmos registros identificados por matchId.”

**Limitações intencionais:** sem persistência de confirmados/pendências, retries avançados, recovery após timeout de POST, cenários configuráveis ou respostas fora de ordem. Sem novos testes E2E/browser; validação desta etapa usa typecheck/lint/build solicitados.

**Verificações da etapa 19:** typecheck, lint e build passaram usando o npm-cli da instalação Node (launcher npm local está quebrado). Build mantém aviso de chunk acima de 500 kB; principal minificado 1.007,92 kB. Nenhum erro nessas verificações. Artefatos de build foram regenerados; nenhum commit.

### Etapa 20 — Paginação do Match History

**Status:** Concluído

**Responsável pela implementação:** Colaborativo — implementação pelo Codex, requisitos definidos pelo usuário.

**O que foi implementado:** Match History agora permite navegar em páginas de cinco registros usando o mesmo PaginationControls do ranking. Dados de data, pontos, eliminações, duração, motivo e configuração foram preservados.

**Arquivos principais envolvidos:** `src/screens/MatchHistory.tsx`, `src/mocks/matchHistoryState.ts`, `DEV_NOTES_PTBR.md`. Contratos, endpoint Axios, handler MSW e hook existentes foram inspecionados e reutilizados sem alterações.

**Como funciona:** React guarda somente o número solicitado da página. useHistory recebe page/pageSize, já incluídos na query key junto ao jogador local, e consulta Axios → MSW. A API filtra pelo jogador, ordena e só então pagina; retorna PaginatedResponse<MatchHistoryRecord> com items/page/pageSize/total/totalPages. PaginationControls usa os metadados da resposta, desabilita Previous na primeira página e Next na última; vazio e página única não permitem navegação inválida. Durante fetch os botões ficam desabilitados. Reabrir a tela começa na página 1 e refaz a consulta por refetchOnMount:always.

**Por que foi feito dessa forma:** a infraestrutura já atendia o contrato original; faltava a navegação da interface. Reutilizar o mesmo componente evita dois sistemas de paginação. INSTRUCOES.md foi lido primeiro e seguido, conforme orientação anterior do usuário. Sem alterações no ranking, gameplay, submissão ou abandono; sem commit.

**Ordenação:** completedAt decrescente (mais recente primeiro), depois matchId crescente por comparação de strings sem locale. IDs únicos tornam o desempate determinístico mesmo em navegadores com idiomas distintos. Histórico reúne configurações diferentes do mesmo jogador; o filtro de compatibilidade continua exclusivo do ranking.

**Confirmações e cache:** sucesso do POST já invalida todas as páginas de history e ranking pelo prefixo da query key. A próxima consulta calcula novamente posição e totais usando a coleção compartilhada de fixtures/confirmados, sem inserir cópias manualmente no React. Novas partidas mais recentes entram no começo e podem deslocar registros entre páginas; uma página posterior permanece selecionada enquanto a tela estiver montada. Abandono não faz POST nem cria registro.

**O que eu preciso entender:** estado de navegação versus dados remotos, chave de query parametrizada, invalidação de múltiplas páginas, paginação após filtro/ordenação e desempate estável. Código escrito pelo Codex: revisar antes da entrevista.

**Como testar manualmente:** abrir histórico e conferir três fixtures em uma página, com ambos os botões desabilitados; concluir três partidas na mesma sessão para ultrapassar cinco registros; abrir histórico e conferir as conclusões mais recentes primeiro, total de seis e duas páginas; usar Next/Previous e verificar ausência de repetição entre páginas; concluir outra partida e reabrir para conferir posição inicial e total atualizado. Conferir que abandono não altera o total e ranking continua navegável. Vazio mantém os dois botões desabilitados quando a API retorna zero registros; não foi criado cenário artificial para isso.

**Possíveis perguntas de entrevista:**

- Onde ficam as partidas da página? “No cache do TanStack Query; React guarda apenas qual página quero consultar.”
- Por que ordenar antes de paginar? “Para que as páginas sejam recortes da mesma sequência cronológica.”
- Como uma confirmação atualiza várias páginas? “A mutation invalida pelo prefixo history, e a API recalcula os dados e totais.”

**Limitações:** confirmados continuam em memória e se perdem após refresh; robustez avançada permanece adiada. Nenhum teste de navegador/E2E executado nesta tarefa; validações solicitadas registradas abaixo.

**Verificações da etapa 20:** typecheck, lint e build passaram pelo npm-cli da instalação Node. Permanece o aviso de chunk maior que 500 kB; principal minificado de 1.008,07 kB. Nenhum erro nessas verificações. Artefatos de build regenerados; sem commit.

### Etapa 21 — Correção de crash ao abrir Leaderboard

**Status:** Concluído — falha reproduzida e corrigida na fronteira HTTP; o gatilho espontâneo da interrupção de MSW no navegador do usuário ainda não foi confirmado.

**Responsável pela implementação:** Colaborativo — relato/teste manual pelo usuário; investigação, correção e regressão pelo Codex.

**O que foi implementado:** Axios exige JSON e rejeita erros de parsing; consultas de ranking/histórico recebem unknown e validam registros e metadados antes de retornar dados ao TanStack Query. Não há fallback para lista vazia nem try/catch genérico no render. Quatro testes Chromium de regressão foram adicionados.

**Arquivos principais envolvidos:** `src/api/client.ts`, `src/api/endpoints.ts`, `src/api/responseValidation.ts`, `tests/ranking.spec.ts`, `DEV_NOTES_PTBR.md`.

**Como funciona:** antes, o tipo genérico de Axios prometia uma resposta paginada sem verificar seu conteúdo. Interromper o Service Worker via CDP reproduziu GET /api/ranking com HTTP 200/text/html (documento da SPA). A string entrava no cache como sucesso; data era truthy, mas data.items era undefined. Ranking lançava TypeError ao chamar map e React desmontava a árvore, deixando #root vazio. Reabrir com refetch podia trocar dados válidos por HTML, explicando o caráter intermitente desse mecanismo. A origem espontânea da interrupção no ambiente do usuário não foi observada nos testes normais e não deve ser apresentada como comprovada.

**Por que foi feito dessa forma:** Accept:application/json também impede o fallback HTML normal do Vite para uma chamada API não interceptada (vira erro HTTP). responseType:json com silentJSONParsing:false rejeita HTML/JSON inválido mesmo em HTTP 200. readPaginatedResponse valida items, registros completos (reutiliza a validação existente de conclusão), rank positivo e metadados inteiros coerentes. Só dados válidos chegam ao cache. Erros seguem o estado de consulta já existente; dados válidos anteriores podem permanecer visíveis com alerta durante falha de atualização. Histórico tinha a mesma suposição e recebeu a mesma proteção. Nenhuma mudança de config, ordenação, paginação, navegação ou gameplay foi necessária.

**O que eu preciso entender:** interfaces TypeScript não existem para validar dados de rede em runtime; usar unknown obriga a provar o contrato. HTTP 200 não garante que a resposta seja JSON nem que tenha o formato esperado. Service Worker e estado dos handlers em memória são coisas distintas. Rejeitar resposta inválida é correção da fronteira HTTP, não fingir sucesso com dados vazios.

**Como testar manualmente:** repetir Menu → Leaderboard → páginas → Menu → History → Menu → Leaderboard; concluir por tempo e derrota e verificar Submitted, ranking e histórico. Se houver falha de interceptação, deve aparecer erro de consulta com navegação disponível, sem tela em branco. Confirmados continuam em memória, sem persistência nova.

**Possíveis perguntas de entrevista:**

- O generic de Axios garante o formato? “Não. Ele ajuda o compilador; eu preciso validar o conteúdo recebido em runtime.”
- Por que a falha parecia aleatória? “Consultas válidas funcionavam; quando chegava HTML como sucesso, o cache era substituído e o render quebrava.”
- Foi um erro do timer? “Não encontrei diferença causal entre tempo e derrota; ambos passaram. Reproduzi a falha interrompendo o worker, mas não confirmei o gatilho espontâneo relatado.”

**Validação:** antes da correção, 80 ciclos de menu/ranking (40 alternando histórico/páginas), quatro conclusões aceleradas e uma partida de 60 segundos reais não causaram crash; interromper o worker reproduziu TypeError e root vazio. Após a correção, quatro testes Playwright Chromium passaram (reabertura/páginas/histórico, worker interrompido com cache prévio, HTTP 200 HTML, JSON com registro inválido). Uma primeira execução falhou só por seletor de teste que ignorava o ID textual junto ao nome; corrigido e repetido com sucesso. Também validei em Chromium os dois motivos de término, POST confirmado, ranking/paginação, histórico e reabertura: zero exceções não tratadas. Os términos foram acelerados apenas na instrumentação, mantendo os caminhos reais do jogo e API. Typecheck/lint/build passaram; build mantém aviso de chunk acima de 500 kB (principal 1.009,01 kB). Playwright avisou sobre NO_COLOR/FORCE_COLOR no ambiente. Relatórios/artefatos de teste e build foram regenerados.

**Limitações observadas:** a consulta desabilitada de status do Result já emite aviso de queryFn ausente no TanStack Query instalado; não causou crash nos testes e não foi alterada nesta correção. Recuperação/persistência avançada continuam fora do escopo. INSTRUCOES.md e AGENTS.md lidos e preservados. Nenhum commit.

### Etapa 22 — Reativação da interceptação antes de consultas e envios

**Status:** Concluído — recuperação validada com interrupção do worker antes da terceira partida. O gatilho espontâneo no navegador do usuário continua sem confirmação independente.

**Responsável pela implementação:** Colaborativo — usuário identificou falha após partidas consecutivas; investigação, código e testes pelo Codex.

**O que foi implementado:** verificação real da interceptação na inicialização e antes de cada chamada Axios. MSW expõe GET /api/mock-status com marcador próprio. Se o worker estiver desativado, inicia; se estiver marcado como ativo mas a requisição não for interceptada, usa stop/start públicos na mesma instância e verifica novamente. Não refaz o POST da partida. Result usa queryFn:skipToken para observar o cache sem warning de função ausente.

**Arquivos principais envolvidos:** `src/mocks/browser.ts`, `src/mocks/handlers.ts`, `src/main.tsx`, `src/api/client.ts`, `src/hooks/useApi.ts`, `tests/ranking.spec.ts`, `DEV_NOTES_PTBR.md`.

**Como funciona:** um interceptor Axios aguarda ensureMockWorkerReady antes de transmitir GET ou POST. O probe usa fetch separado, Accept JSON, no-store e limite de três segundos, evitando recursão no interceptor. Valida resposta e marcador, não somente readyState. Chamadas simultâneas compartilham a Promise de verificação/ativação; finally libera a referência ao terminar. Perda de interceptação com resposta não correspondente permite uma reativação; falhas reais da verificação continuam propagadas para a query/mutation, sem sucesso fictício. Map de confirmados e handlers continuam na mesma página e não são recriados. Assim, reiniciar o Service Worker não apaga a coleção da sessão; refresh da página ainda apaga.

**Por que foi feito dessa forma:** a etapa 21 protegia o render, mas não restaurava o transporte MSW. Depois de perder o conjunto de clientes ativos no Service Worker, a instância da página pode continuar marcada como enabled e novos envios/consultas chegam ao servidor Vite. Apenas tratar isso como Failed deixa o jogador preso com cache antigo. A verificação anterior ao envio evita transmitir a conclusão enquanto a interceptação estiver ausente. Isso corrige o lifecycle do mock; não implementa outbox, persistência ou reenvio automático de POST. INSTRUCOES.md foi lido primeiro e preservado; sem commit.

**O que eu preciso entender:** estado da instância JavaScript não prova que o transporte está interceptando; probe verifica o comportamento. Estado da página (Map) e estado do Service Worker (clientes ativos) são diferentes. Promise compartilhada evita reativações simultâneas; skipToken indica que a consulta de status não possui fetch. Código implementado pelo Codex: estudar esses pontos antes da entrevista.

**Como testar manualmente:** jogar quatro partidas sem refresh, alternando tempo/derrota; cada Result deve apresentar Submitted; conferir contagem crescente no ranking da mesma configuração e histórico, inclusive paginação. Abandono continua sem envio. Registros que já falharam antes desta correção não são reconstruídos; recuperação de pendências permanece futura.

**Possíveis perguntas de entrevista:**

- Por que verificar antes do POST? “Para corrigir a interceptação antes de transmitir; não preciso repetir uma requisição que possa ter sido registrada.”
- Reiniciar MSW apaga o histórico? “Não nesta correção: a mesma instância e o Map da página são preservados. Refresh da página ainda perde os confirmados.”
- Por que não basta readyState? “A biblioteca pode estar enabled enquanto o worker do navegador perdeu os clientes ativos.”

**Validação:** doze partidas consecutivas aceleradas inicialmente passaram, portanto não há prova de um limite fixo na terceira partida. Teste de regressão agora interrompe o worker antes da terceira, conclui quatro partidas pelos caminhos reais de Game/Result/POST, verifica Submitted e contagens exatas nas duas abas sem alertas ou exceções. Términos acelerados só na instrumentação; não é teste completo de combate. Cinco testes Chromium passaram: quatro partidas com recuperação, reabertura/paginação/histórico, recuperação antes de ranking, rejeição de HTML HTTP 200 e JSON inválido. Ajustei os imports da instrumentação para usar as URLs realmente carregadas pelo Vite, incluindo parâmetros de HMR; antes, duas injeções de resposta usavam outra instância desativada e o teste não exercitava a falha. Typecheck, lint e build passaram. Principal chunk 1.009,73 kB, mantendo aviso acima de 500 kB; Playwright mantém aviso ambiental NO_COLOR/FORCE_COLOR. Artefatos de build/teste regenerados.

**Limitações e tradeoff:** há uma requisição pequena de verificação por chamada da API (compartilhada quando simultânea). A API do jogo é exclusivamente MSW nesta etapa. Não implementamos confirmação persistente, recuperação de partidas antigas falhadas, retries de POST, cenários configuráveis ou robustez completa de rede. Não atribuir o gatilho espontâneo a tempo/derrota sem evidência adicional.

### Etapa 23 — Confirmados persistentes e submissão idempotente

**Status:** Concluído

**Responsável pela implementação:** Colaborativo — implementação pelo Codex, requisitos e decisões com o usuário.

**O que foi implementado:** confirmados persistem após refresh; POST usa matchId para recuperar reenvios iguais ou rejeitar conflitos; reset remove apenas confirmados criados pelo usuário. Fixture, ranking e histórico continuam usando os contratos e fluxo TanStack Query → Axios → MSW existentes.

**Arquivos principais envolvidos:** `src/storage/confirmedMatchesStorage.ts`, `src/mocks/matchHistoryState.ts`, `src/mocks/handlers.ts`, `tests/confirmedMatches.spec.ts`, `DEV_NOTES_PTBR.md`.

**Como funciona:** localStorage usa a chave `pirate-battle:confirmed-matches:v1` com `{ version: 1, records: MatchHistoryRecord[] }`. Registros contêm ID da partida/jogador, nome, data, score, eliminações, duração efetiva, motivo, HP e snapshot completo de GameConfig. Não persistimos status de mutation, rank calculado ou fixtures. Records são gravados em ordem de ID para manter representação determinística. O Map hidrata uma vez ao carregar o módulo, antes das consultas, e continua sendo a coleção compartilhada do mock. Recuperar a interceptação via stop/start preserva a mesma coleção.

**Por que foi feito dessa forma:** persistir na camada do servidor simulado distingue conclusão local de aceitação. O handler valida o contrato e registerMockMatch verifica duplicação/conflito; uma criação nova salva a coleção proposta antes de alterar o Map e retornar 201. Se setItem falha, retorna 503, sem confirmação em memória nem sucesso de API. Reenvio de registro já aceito retorna 200 com os dados existentes, sem nova escrita. Não criamos armazenamento paralelo para cada aba. INSTRUCOES.md e AGENTS.md foram lidos primeiro; sem commit.

**Validação do armazenamento:** leitura ausente, bloqueada, JSON malformado, envelope incompatível, records inválidos, IDs duplicados ou colisão com IDs reservados de fixtures levam a coleção confirmada vazia, mantendo fixtures. A validação reutiliza isHistoryRecord, incluindo config completo requerido e regras de motivo/tempo/HP. Um registro inválido rejeita o dataset inteiro; não preenchemos campos nem tentamos adivinhar qual duplicata deveria vencer. O dado corrompido não é reescrito na leitura: uma nova aceitação válida ou reset poderá substituí-lo/removê-lo.

**Idempotência e conflito:** matchId é único globalmente nessa coleção, inclusive fixtures. Comparamos todos os campos definidos no contrato: matchId/playerId/playerName/completedAt/score/enemiesDefeated/durationSeconds/endReason/playerHealth e config inteiro. Ordem das propriedades não altera igualdade do GameConfig, graças à chave canônica existente. Texto da data é comparado exatamente. Reenvio igual retorna o registro aceito, no mesmo processo e após refresh; mesmo ID com qualquer desses valores diferente retorna 409, sem sobrescrever memória/storage nem duplicar. Propriedades extras fora do contrato não definem identidade de uma partida.

**Ranking e histórico:** fixtures ficam separadas e são combinadas por ID com os confirmados hidratados. Configuração compatível, ordenações e paginação não foram alteradas; totais refletem essa coleção. Invalidação por prefixos history/ranking após sucesso permanece existente. Abandono nunca chama POST e nunca entra nessa chave. Result mantém status da mutation na sessão; restaurar seu resultado após refresh não reenvia nem restaura cache de status remoto nesta etapa.

**Reset:** `resetConfirmedMockMatches()` exportado por matchHistoryState remove a chave e limpa o Map, retornando true. Se removeItem falhar, retorna false e preserva memória. Fixtures, Options e último resultado local não são apagados. É uma função de infraestrutura preparada para futura seleção/reset de cenários; não criamos UI nem endpoint destrutivo novo. Queries consultadas novamente passam a refletir somente fixtures; a função isolada não modifica o cache React diretamente.

**O que eu preciso entender:** confirmação versus conclusão, commit após persistência, Map como índice da coleção, type guards de JSON desconhecido, formatos versionados e idempotência por chave estável. Código com assistência do Codex: revisar comparação completa e as respostas 200/201/409/503 antes de apresentar em entrevista.

**Como testar manualmente:** concluir uma partida e esperar Submitted; abrir histórico e ranking com configuração compatível; atualizar a página e conferir a mesma partida e totais. Jogar outra partida e conferir ambas sem duplicação. Em armazenamento do navegador, conferir apenas confirmados em records. Os testes automatizados exercitam POST repetido, conflito e reset diretamente pela infraestrutura real; não há botão de reenvio ou reset nesta etapa.

**Possíveis perguntas de entrevista:**

- Por que não salvar como confirmado no Game? “Encerrar o jogo cria um resultado local; só a API pode aceitar esse registro.”
- O que é idempotência aqui? “Repetir o mesmo POST com o mesmo matchId e dados recupera a mesma partida, sem somar entradas.”
- E se o ID repetir com dados diferentes? “Retorno 409 e preservo o registro original.”
- E se localStorage estiver cheio? “Não respondo com confirmação durável falsa; o POST retorna 503 e o Map não recebe a partida.”
- Por que fixtures não estão no storage? “São o estado inicial determinístico; persistimos apenas os registros novos.”

**Limitações intencionais:** sem outbox/pendências persistentes, retry de POST, recuperação após timeout com resposta perdida, sincronização concorrente entre abas, migração de versões desconhecidas ou UI completa de cenários. Falhas de escrita continuam visíveis no Result e não bloqueiam outro jogo. Partidas que falharam em etapas anteriores não são reconstruídas.

**Verificações da etapa 23:** 15 testes Playwright Chromium passaram: dez focados em persistência/idempotência/conflitos/reset/corrupção/acesso ou escrita de storage e cinco regressões de ranking/MSW. Typecheck, lint e build passaram pelo npm-cli da instalação Node. A primeira checagem estática encontrou uma união de status que não permitia estreitamento pelo TypeScript; separei os casos conflict/storage_unavailable e repeti typecheck/build com sucesso. Nenhum erro final; aviso de chunk maior que 500 kB permanece (principal 1.010,87 kB), além de NO_COLOR/FORCE_COLOR no runner. Artefatos de build/teste regenerados; sem commit.

### Etapa 24 — Pendências persistentes e retry explícito

**Status:** Concluído

**Responsável pela implementação:** Colaborativo — código pelo Codex; requisitos e decisões com o usuário.

**O que foi implementado:** conclusão → pendência salva → POST → confirmação validada → retirada da pendência. Falhas deixam o payload disponível para retry no Result ou Main Menu, inclusive após refresh e para partidas antigas. Play Again permanece disponível. Não há POST automático no startup ou remount.

**Arquivos principais envolvidos:** `src/storage/pendingMatchesStorage.ts`, `src/hooks/usePendingMatches.ts`, `src/hooks/useApi.ts`, `src/components/PendingSubmissions.tsx`, `src/screens/Result.tsx`, `src/screens/MainMenu.tsx`, `src/api/endpoints.ts`, `src/api/matchContracts.ts`, `src/mocks/matchHistoryState.ts`, `tests/pendingMatches.spec.ts`, `DEV_NOTES_PTBR.md`.

**Como funciona:** chave `pirate-battle:pending-matches:v1`, envelope `{ version: 1, records: SubmitMatchRequest[] }`, separado dos confirmados. Cada registro guarda o ID original, identidade do jogador, data, pontuação, eliminações, duração ativa, motivo, HP e GameConfig completo. Campos não são recalculados a partir de Options. Uma cópia independente do payload entra na coleção; IDs diferentes coexistem, reentrada do mesmo payload não duplica e dados diferentes com o mesmo ID não sobrescrevem o pendente original.

**Criação/remoção:** mutationFn salva primeiro; se não consegue persistir, não envia, mantém cópia na sessão e mostra aviso para não fechar a página. Falha de POST ou confirmação incompatível mantém a pendência. Após resposta válida/equivalente, onSuccess remove e publica Submitted, invalidando todas as queries history/ranking. Se a gravação da remoção falhar, a confirmação continua real, mas a pendência permanece com aviso e pode ser reenviada para concluir a limpeza.

**Retry e idempotência:** mesmo useSubmitMatch serve App e botões; uma Promise em andamento por matchId é compartilhada entre chamadas simultâneas. Botão fica desabilitado durante o envio; mesmo cliques síncronos repetidos produzem um único POST. API compara todos os campos do contrato pela função isSameMatch compartilhada com o mock, incluindo config canônico. O endpoint Axios valida a resposta desconhecida antes de tratá-la como confirmação. Reenvio após resposta perdida recupera o registro existente via 200; não gera UUID novo nem duplicate no ranking/histórico.

**Conflito:** 409 mostra mensagem específica e preserva o payload para diagnóstico/recovery. Não descartamos nem sobrescrevemos o pendente ou o confirmado. A mensagem de falha é da sessão; após refresh, o payload continua pendente e um novo retry pode recuperar a razão novamente.

**React:** componente pequeno lista contagem, score/data/ID, estado e Retry registration. Está no Result e menu para alcançar pendências antigas. useSyncExternalStore usa snapshot estável e unsubscribe para funcionar em Strict Mode. Eventos são apenas da coleção e da mutation, sem coordenadas/frame. Cache de status continua por matchId; quando o cache ainda não conhece a submissão, a presença de um payload salvo representa Pending registration, nunca Submitted presumido. Falha de storage e API são apresentadas por mensagens acessíveis; gameplay não aguarda retries.

**Segurança de leitura:** JSON, versão, envelope, contrato completo e unicidade de IDs são validados. Coleção inválida é rejeitada inteira, sem completar campos ou enviar dados automaticamente. Erro de leitura vira aviso e não impede menu/jogo. Não apagamos/reescrevemos dados inválidos durante a leitura; uma pendência nova salva poderá substituí-los. Sem acesso ao storage não há garantia de sobrevivência ao refresh, e a interface informa isso.

**Por que foi feito dessa forma:** INSTRUCOES.md exige manter conclusões incertas, permitir outra partida e registrar apenas uma vez. Mantivemos a stack, a persistência de confirmados, a recuperação MSW, filtros/ordenação/paginação e abandono. A comparação existente foi extraída para os contratos para reutilizar o mesmo critério no servidor e no receipt. Abandono não chama mutation e não cria pendência. Reset exclusivo dos confirmados permanece exclusivo; não apaga pendências silenciosamente. Sem commit.

**O que eu preciso entender:** payload local não é confirmação remota; resposta HTTP 200 precisa representar a mesma partida; fila de várias conclusões é diferente de “último resultado”; estado da tentativa versus dados persistentes; Promise compartilhada e lifecycle de callbacks após sair da tela. Estudar o código escrito pelo Codex antes de explicar em entrevista.

**Como testar manualmente:** concluir e esperar Submitted, conferindo records vazio na chave de pendências. Em falha, confirmar a presença do payload/Retry, atualizar e verificar Pending registration sem envio automático; Retry deve confirmar/remover. Fazer outra partida enquanto a primeira está pendente; ambas devem manter IDs/configs independentes. Reenviar uma partida já aceita não aumenta totais. Para falhas reproduzíveis, os testes injetam handlers somente na própria execução; ainda não há seletor de cenários para a UI.

**Possíveis perguntas de entrevista:**

- Por que persistir antes do POST? “Se atualizar a página durante a chamada, o payload ainda existe para reenviar.”
- Por que pending e confirmed são separados? “O cliente sabe que tem algo a enviar; só a API pode aceitar.”
- E se a resposta se perder depois de gravar no servidor? “O pending fica; o mesmo ID recupera o registro existente no retry.”
- Como várias partidas coexistem? “Uma coleção por matchId guarda cada payload, sem substituir a partida anterior.”
- Como evito duas chamadas por clique repetido? “Desabilito o botão e compartilho a tentativa em andamento pelo ID.”

**Limitações intencionais:** sem seletor completo de cenários, backoff/auto retry, sincronização concorrente entre abas ou UI para editar/apagar payloads conflitantes. Payloads de etapas anteriores que já foram perdidos não são reconstruídos. Status remoto de submissões antigas confirmadas não é persistido como uma segunda coleção; o último Result sem pendência/cache ainda informa Not submitted in this session.

**Verificações da etapa 24:** 28 testes Chromium passaram: 13 focados em pendências/retry e 15 regressões de confirmados/ranking/MSW. Cobrem persistência antes de POST, refresh sem envio automático, sucesso/limpeza, resposta perdida após aceitação, várias pendências, outra partida jogável, conflito, cliques repetidos, receipt incompatível, falha de gravação/limpeza de storage, abandono e corrupção. Conclusões são aceleradas só pela instrumentação; não representam teste completo de combate. Typecheck, lint e build passaram usando npm-cli da instalação Node. Corrigi a inferência de setQueryData usando updater para o novo status failed com message e repeti typecheck. Build mantém aviso de chunk acima de 500 kB (principal 1.014,74 kB); runner mantém aviso NO_COLOR/FORCE_COLOR. Artefatos de build/teste regenerados. Sem commit.

## 5. Conceitos importantes para estudar

- **useSyncExternalStore:** conecta um pequeno estado local externo ao React por snapshot estável e assinatura com cleanup. Aqui observa conclusões pendentes, não gameplay contínuo.
- **Resultado incerto:** timeout ou perda de resposta não prova que o servidor deixou de gravar. Persistir e reenviar pelo mesmo ID permite descobrir a confirmação.
- **Compartilhar Promise por ID:** várias intenções iguais podem aguardar o mesmo trabalho em andamento, evitando POSTs simultâneos desnecessários.

- **Idempotência por matchId:** um identificador estável permite reconhecer a mesma escrita após refresh; dados conflitantes precisam de tratamento explícito, não sobrescrita.
- **Persistir antes de confirmar:** gravar com sucesso antes de atualizar memória/responder evita aceitar um registro que desapareceria após refresh por falha de armazenamento.
- **Versionamento de dados:** uma versão conhecida permite validar o envelope; versões incompatíveis exigem migração deliberada, não inferência silenciosa.

- **Verificar transporte antes de enviar:** uma checagem pequena confirma a interceptação e permite corrigir o lifecycle sem repetir uma operação de escrita. Não equivale a recuperação de pendências.

- **Validação na fronteira HTTP:** tipos estáticos não verificam respostas externas. JSON inválido ou metadados incorretos devem falhar na query antes de entrar no cache e alcançar o render.

- **Serialização canônica:** representar os mesmos valores com as mesmas chaves ordenadas permite comparação determinística de objetos aninhados.
- **Ordenação total e paginação:** desempates estáveis evitam posições ambíguas; filtrar e ordenar precedem o recorte da página.
- **Query key parametrizada:** configuração e página identificam consultas diferentes; invalidação pelo prefixo ranking atualiza todas as variantes.

- **Mutation:** gerencia envio e estados de operação; não substitui simulação e não deve repetir POST por efeitos de montagem.
- **Invalidação de cache:** marca consultas relacionadas como desatualizadas; refetch consulta o mock/servidor novamente.
- **DTO:** contrato de transporte compartilhado entre endpoint, handler e tela; conversão fica na fronteira da aplicação.
- **Estado de mock:** Map de servidor simulado guarda registros confirmados sem virar estado React; memória ainda não é persistência.

- **Snapshot final:** dados independentes capturados na conclusão, usados para UI/storage sem compartilhar estado contínuo.
- **Conclusão vs abandono:** finish produz resultado; destroy libera recursos e não concede conclusão.
- **Persistência local vs registro remoto:** salvar JSON permite refresh; não comprova envio nem confirmação de servidor.
- **Identidade da partida:** UUID identifica conclusão para futura integração e prevenção de duplicação; protocolo remoto ainda não implementado.

- **Draft vs opção salva:** edição local do formulário só passa a valer após Save; gameplay usa snapshot próprio.
- **Persistência não confiável:** JSON parse não garante formato; tratar como unknown e validar tipos/faixas antes de usar.
- **Lazy useState:** lê opções ao montar a tela e mantém identidade da config durante os renders seguintes.
- **Schema versionado:** versão identifica o formato do storage; formato desconhecido volta a defaults seguros.

- **Lista de descrição:** dl reúne pares dt (rótulo) e dd (valor), úteis para estatísticas do jogo.
- **Imagem decorativa:** alt vazio evita leitura redundante quando texto já explica o ícone.
- **Região live limitada:** role=status anuncia mudanças de estado; não envolve cronômetro, evitando anúncios contínuos.

- **Pausa do relógio:** parar updates mantém todos os valores temporais; reset de lastTime/acumulador descarta tempo de parede da pausa.
- **blur e visibilitychange:** perder foco e ocultar documento são eventos diferentes; ambos pausam, nenhum retoma.
- **Ref imperativa restrita:** permite enviar comandos a um recurso externo sem entregar sua instância ou tornar React dono do estado.
- **Dialog modal nativo:** showModal torna fundo inerte e controla foco; cleanup deve fechar para tolerar remount.

- **Snapshot de apresentação:** cópia pequena dos dados relevantes; readonly/freeze não transformam React na fonte de gameplay.
- **Comparação antes de notificar:** publicar somente diferenças visíveis evita updates por movimento ou frações do timer.
- **Máscara Pixi:** recorta preenchimento de uma textura mantendo sua forma; barra em camada separada não gira com o navio.

- **Atribuição de morte:** pontuação depende de quem causou o golpe fatal, e não apenas da ausência de um inimigo.
- **Transição idempotente:** finishMatch só muda running uma vez; chamadas posteriores preservam motivo e resultado.
- **Retorno antecipado:** sair do update imediatamente após derrota impede ações posteriores no mesmo passo.

- **Tempo simulado vs. relógio real:** tempo do jogo é soma dos deltas executados; relógio de parede continua passando mesmo sem updates. O loop pode limitar atrasos.
- **Estado autoritativo e lifecycle:** GameState decide tempo/status reais; running permite regras e finished impede avanço. Renderizar não significa simular.
- **Precisão temporal:** manter frações de segundo e limitar o último delta evita perder precisão; arredondamento deve ficar na apresentação futura.

- **Pseudoaleatoriedade e seed:** algoritmo determinístico que parece aleatório; seed define estado inicial. Repetir seed e chamadas repete valores.
- **Escolha ponderada:** probabilidade é peso dividido pela soma; 60/40 equivale a 0,6/0,4, mas não exige quota exata por partida.
- **Rejeição com limite:** sorteia candidatos e descarta inválidos até um máximo. Evita criação insegura e travamento quando a arena não tem espaço.

- **Alcance de ataque:** distância lógica entre centros que decide aproximação versus disparo; não usa tamanho CSS ou bounds de Sprite.
- **Proprietário/equipe:** `ownerId` identifica quem disparou; `isPlayerOwned` define quais entidades são alvos válidos. Projétil permanece independente depois de nascer.
- **União discriminada e Pick:** `type` permite ao TypeScript garantir campo exclusivo do Shooter. `Pick` restringe a factory aos parâmetros de projétil que realmente usa.

- **Vetor para o alvo e normalização:** alvo menos origem produz direção e distância; dividir pelo comprimento deixa só a direção, mantendo velocidade constante.
- **atan2:** recupera ângulo respeitando os quadrantes; `atan2(dx, -dy)` adapta a função à frente para cima usada pelos navios.
- **Ordem de colisão:** selecionar o primeiro collider e aplicar dano imediatamente impede atravessar ilha ou processar entidade que já morreu. Ordem é parte da regra, não apenas detalhe de código.

- **Radianos e direção:** π radianos são 180°, e π/2 são 90°. Seno/cosseno convertem o ângulo em direção unitária; neste jogo frente é `(sin(r), -cos(r))` porque Y cresce para baixo.
- **Vetores perpendiculares:** girar a direção em 90° produz o lado do navio. As três balas usam a mesma direção lateral e offsets diferentes ao longo da direção frontal.
- **Cooldown na simulação:** tempo restante da arma diminui pelo delta, sem `setTimeout`. Só repetir quando chega a zero mantém uma taxa de disparo definida pelo tempo da simulação.
- **Colisão por segmento:** verifica também o caminho entre duas posições, evitando perder um obstáculo atravessado durante um update. Projeta o centro do círculo nesse caminho e compara com a soma dos raios.

- **Lifecycle do React e `useEffect`:** `useEffect` sincroniza um componente com sistemas externos, aqui a inicialização do Pixi. O cleanup libera o recurso na desmontagem.
- **React Strict Mode:** em desenvolvimento, ajuda a revelar efeitos que não limpam recursos corretamente. O app é envolvido por `StrictMode`; por isso a criação do Pixi precisa tolerar setup/cleanup repetido.
- **PixiJS `Application`:** gerencia renderer, stage e canvas. Usa coordenadas lógicas 960 × 600, ticker automático desligado e `render()` chamado pelo loop do jogo.
- **`requestAnimationFrame`:** agenda callback antes do próximo repaint do navegador. É usado para agendar os frames do loop.
- **Loop e delta time:** o loop separa chamadas de update e render. Delta é tempo decorrido; aqui cada update recebe 1/60 s fixo.
- **Fixed timestep:** mantém o tamanho dos passos da simulação estável mesmo quando os frames de desenho variam. O movimento usa passos de 1/60 s.
- **Simulação vs. renderização:** `MovementSystem` altera posição/rotação; `GameRenderer` transfere esses valores ao sprite. React não atualiza por frame.
- **Interpolação:** usa estados anteriores e atuais para suavizar o desenho entre passos fixos. O loop calcula `alpha`, mas o jogo não guarda estados anteriores nem aplica o valor.
- **Entidade:** registro simples com ID, posição, rotação e vida. A nave existe no mapa de `GameState`; wrappers sem uso foram removidos.
- **Detecção de colisão:** navio e ilha usam círculos. Distância menor que a soma dos raios significa sobreposição; o sistema corrige a posição no estado lógico.
- **Carregamento de assets:** `gameAssets.ts` centraliza os PNGs do navio, da ilha e da água. Carrega em paralelo, espera todas as operações terminarem e libera texturas bem-sucedidas caso alguma falhe. Texturas são reutilizadas pelos sprites e liberadas após os display objects.
- **Coordenadas locais/mundiais:** tiles e colliders têm offsets relativos ao centro da ilha; somar a posição da ilha produz coordenadas da arena.
- **TilingSprite:** repete uma textura de água sem criar um sprite por quadrado do fundo.
- **Estado local vs. remoto:** navegação/loading são estado React; ranking/histórico são dados remotos em Query; coordenadas contínuas ficam no `GameState` da simulação.
- **Cache TanStack Query:** resultados ficam associados a query keys; a mutation prevê invalidar ranking e histórico após sucesso.
- **Axios:** cliente HTTP configurado com base `/api`, JSON e timeout; MSW intercepta chamadas no desenvolvimento.
- **MSW:** mocka a fronteira de rede e permite que o código cliente use requisições reais do navegador sem servidor de API.
- **Playwright E2E:** controla um browser real para verificar fluxos completos visíveis. Os testes atuais cobrem navegação, não regras do jogo.
- **Idempotência:** há proteção básica de ID no mock (etapa 18), mas protocolo completo de recuperação/idempotência ainda não foi implementado. Vale estudar quando envio/retry de partidas entrar no escopo, para evitar duplicar submissões.

## 6. Perguntas que eu deveria conseguir responder

- **Como o ranking compara partidas justas?** “Ele exige igualdade de todos os parâmetros do snapshot, ordena por pontos e aplica desempates estáveis antes de paginar.”
- **Por que o ranking atual não mostra minha partida antiga após mudar Options?** “A tela consulta a configuração salva atual; a partida antiga pertence a outra configuração.”

- **Como a conclusão vira histórico?** “Mutation Query → Axios → POST MSW → Map confirmado; GET retorna registro e cache é invalidado.”
- **Sucesso local é sucesso da API?** “Não; Result usa onSuccess HTTP para Submitted. Salvar JSON local é outra operação.”

- **Como resultado chega à UI?** “Game emite callback uma vez; Canvas encaminha, Game screen navega e App persiste/apresenta.”
- **Por que abandono não sobrescreve resultado?** “Sair chama cleanup, sem callback de conclusão ou gravação.”
- **Como Play Again usa opções novas?** “Remonta Game e captura Options atuais, sem ler config do resultado anterior.”

- **Como opções sobrevivem refresh?** “Save grava duas opções validadas em localStorage versionado; nova tela lê e valida antes de usar.”
- **Por que partida ativa não muda?** “Tela captura config uma vez e Game.start copia; nenhum update consulta storage.”

- **Como o HUD é acessível fora do canvas?** “Valores ficam em dl/dt/dd no DOM e vêm do mesmo snapshot apresentado visualmente.”
- **Por que não anunciar cada segundo?** “Interromperia a leitura; timer é consultável, enquanto só o estado é anunciado automaticamente.”

- **Pausa é só bloquear input?** “Não; paro o loop e bloqueio updates. Toda simulação e seus timers ficam congelados.”
- **O que acontece ao voltar à aba?** “Continua paused até Resume; não simulo o tempo decorrido fora do jogo.”

- **Como HUD recebe dados sem 60 Hz?** “Game compara HP/pontos/segundo/status e chama o callback só quando mudam; Canvas encaminha à tela.”
- **Como evita UI calcular gameplay?** “React apenas formata snapshots imutáveis; regras permanecem no GameState.”

- **Como evita pontos duplicados?** “O golpe fatal remove o inimigo; outro evento não encontra um alvo vivo.”
- **Quem decide derrota e empate com timer?** “Game centraliza o término: dano no último passo ativo vem antes do time-up; tempo já zero impede gameplay.”
- **Por que contato não pontua?** “Não foi um golpe fatal de projétil do jogador.”

- **Quem controla o timer?** “Game reduz o tempo no GameState usando delta; React não executa countdown.”
- **O que congela após o fim?** “Todos os sistemas deixam de ser chamados: movimento, armas, projéteis, dano, cooldowns e spawn.”
- **Como impede término duplicado?** “O update e finishMatch verificam se o status ainda é running.”

- **Como reproduzir os spawns?** “Uso a mesma seed, configuração, estado inicial, deltas e inputs; comparo IDs, tipos e posições.”
- **Quem cria os inimigos e quem controla a IA?** “SpawnSystem valida posições e chama factories; MovementSystem e CombatSystem controlam comportamento.”
- **O que acontece sem espaço livre?** “Após o máximo de tentativas, pulo a criação e aguardo o próximo intervalo.”

- **Por que o Shooter para e suas balas não perseguem?** “Distância define o alcance; a bala guarda direção fixa calculada no disparo.”
- **Como cada Shooter dispara independentemente?** “O cooldown restante pertence ao registro de cada entidade e diminui pelo delta da simulação.”
- **Como evita fogo amigo e usa cobertura?** “Filtro de equipe escolhe alvos válidos; o primeiro impacto com a ilha consome a bala antes de atingir alguém atrás.”

- **Como funciona a perseguição?** “Normalizo jogador menos inimigo, multiplico por velocidade e delta e uso atan2 para orientar o sprite pelo estado.”
- **Como evita atingir alvo atrás da ilha?** “Escolho a menor fração de entrada no segmento; ilha ganha empate.”
- **Como evita dano repetido e por que sem pathfinding?** “Removo fontes consumidas e inimigos mortos imediatamente. Perseguição direta com bloqueio basta para o escopo atual.”

- **Como calculo a trajetória e os lados?** “Frente é (sin(r), -cos(r)); esquerda/direita usam r menos/mais π/2. Os três tiros têm offsets diferentes e direção igual.”
- **Por que projéteis ficam no GameState?** “Colisão e duração pertencem à simulação; Pixi apenas representa os dados.”
- **Como funcionam cooldown e remoção?** “Subtraio delta do tempo restante e removo tiros expirados, fora da arena ou atingindo ilhas. Não dependo de timers ou frames de renderização.”

- **Por que React não controla a posição do navio a cada frame?** “A posição fica no `GameState` mutável da simulação. React não precisa renderizar novamente a cada update.”
- **Qual a diferença entre simulação e renderização?** “O sistema muda posição e rotação em passos fixos; o renderer transfere esses valores para o sprite Pixi.”
- **Por que usar fixed timestep?** “Para que as regras avancem em passos previsíveis mesmo se a taxa de frames variar.”
- **Como PixiJS entra no ciclo de vida do React?** “`GameCanvas` cria a Application e o jogo em `useEffect`; no cleanup para o loop, remove input, destrói renderer, textura e Application.”
- **Como evitamos listeners ou loops duplicados?** “A tela instancia o jogo enquanto está montada; o loop impede duplicação e cancela RAF. `InputManager.detach` remove listeners e reseta as teclas.”
- **Por que existe `GameConfig`?** “Agrupa valores tipados da partida. No start, o jogo copia a configuração, e as entidades/sistemas recebem valores explícitos.”
- **Por que TanStack Query para ranking, mas não para o estado do jogo?** “Ranking é dado remoto assíncrono e cacheável; a simulação é local e atualizada continuamente.”
- **O ranking atual vem de um servidor real?** “Não em desenvolvimento: MSW intercepta a chamada e responde com fixtures.”
- **Quais assets são usados na partida?** “O navio oficial, o tile de água 73 e uma composição de costa, grama, planta e rocha listada no marco #3.”
- **O que os testes automatizados garantem hoje?** “A abertura do menu e alguns caminhos de navegação. Não garantem que o jogo seja jogável.”

## 7. Pontos que ainda não domino

- **Pendências e retry implementados pelo Codex em colaboração:** revisar persist-before-POST, validação de receipt, limpeza que pode falhar, coleção múltipla, status por ID, Promise compartilhada e subscribe/unsubscribe. Saber explicar os limites de storage bloqueado e concorrência entre abas.

- **Confirmados persistentes pelo Codex em colaboração:** revisar dataset versionado, rejeição integral de corrupção, hidratação do Map, conflito 409, falha de escrita 503, reset e limites de concorrência entre abas. Diferenciar essa etapa da futura recuperação de pendências.

- **Reativação MSW pelo Codex em colaboração:** revisar probe, Promise compartilhada, interceptor Axios assíncrono, stop/start na mesma instância, diferença entre worker e Map da página, e limite entre recuperação de transporte e retry de POST.

- **Correção de runtime pelo Codex em colaboração:** estudar parsing Axios, Accept versus Content-Type, unknown/type guards, cache preservado após refetch falho e reprodução de falha de Service Worker via CDP. Distinguir causa de render comprovada do gatilho ambiental ainda não confirmado.

- **Histórico paginado implementado pelo Codex em colaboração:** revisar query key por jogador/página, recálculo dos totais, deslocamento de registros após novas confirmações e reutilização do componente de navegação.

- **Ranking implementado pelo Codex em colaboração:** revisar canonicalização recursiva, igualdade da configuração inteira, comparação de strings sem locale, ranking por partida, Map compartilhado e invalidação por prefixo. Validar navegação por teclado e fluxos reais no navegador antes da entrevista.

- **Integração API implementada pelo Codex em colaboração:** revisar callbacks de mutation, cache por ID, disabled query de status, DTO, validação do POST, worker MSW 3 e diferença entre memória/persistência. Robustez original completa ainda precisa de estudo/implementação.

- **Result implementado pelo Codex em colaboração:** revisar callback único, config congelada, tipo que exclui quit, validação completa de JSON, marcador #result e preparação de registro sem fingir sucesso de API.

- **Options implementado pelo Codex em colaboração:** revisar validação de unknown, try/catch de storage, draft strings, sucesso/erro acessível, limites de spawn e momento da captura da configuração no Play Again.

- **HUD semântico implementado pelo Codex em colaboração:** estudar listas de descrição, alt vazio, live regions e revisar manualmente comportamento com leitor de tela; checks estáticos não garantem experiência assistiva.

- **Pausa implementada pelo Codex em colaboração:** revisar transições running/paused/finished, retorno explícito, reset do relógio, repeat de teclado, controles por ref, foco do dialog e cleanup de listeners.

- **HUD implementado pelo Codex em colaboração:** estudar bridge de callback, ref sem restart do efeito, snapshot congelado, publicação após retorno antecipado, timer inteiro de apresentação e máscara/barra com cleanup em Pixi.

- **Pontuação/derrota implementadas pelo Codex em colaboração:** revisar causa da morte, snapshot das recompensas, interrupção imediata, contabilização do último subpasso e diferença defeated/player_defeated antes de conectar Result. Entender que histórico anterior registra o comportamento de cada etapa, não o comportamento atual.

- **Timer implementado pelo Codex em colaboração:** revisar delta parcial final, precisão de ponto flutuante, guard central e reset do loop após finished. Saber explicar a sincronização do timer com o HUD introduzida na etapa 13.

- **Spawn implementado pelo Codex em colaboração:** estudar LCG, Math.imul, conversão unsigned, distribuição ponderada e por que o consumo aleatório muda ao rejeitar uma posição. Revisar timer da simulação e reset por partida.

- **Shooter implementado pelo Codex em colaboração:** revisar alcance, união discriminada, cooldown individual e ordem tiro/remoção/disparo. Saber distinguir mira atual de tiro guiado e explicar a limitação de sobreposição física.

- **Chaser implementado pelo Codex em colaboração:** revisar perseguição normalizada, rotação, interseção segmento/círculo e a ordem tiro/contato. Saber demonstrar health via debugger sem confundir com o HUD placeholder.

- **Armas implementadas pelo Codex neste marco colaborativo:** revisar as fórmulas de origem/direção e a colisão por segmento antes de explicar como se tivesse domínio delas. Explicar autoria com transparência.
- **Radianos:** π representa 180°; π/2 representa 90°. Rotação Pixi e simulação usam radianos.
- **Seno/cosseno e perpendiculares:** geram direção de comprimento 1; rotação zero é para cima neste projeto. Somar/subtrair π/2 produz direções laterais.
- **Cooldown de simulação:** estudar segundos restantes, tolerância decimal e diferença entre segurar uma tecla e um evento único. O delta também controla duração e deslocamento.
- **Colisão contínua do projétil:** estudar projeção no segmento e soma dos raios para entender como evita atravessar obstáculos entre updates.

- **Fixed timestep e interpolação:** movimento já usa update fixo; renderer ainda não aplica alpha. Entender a implementação e o motivo de não haver interpolação nesta fatia.
- **Lifecycle assíncrono e Strict Mode:** entender cancelamento durante decode do PNG e `Application.init`, além da ordem de destruir textura, renderer e app.
- **Vetores e radianos:** estudar seno/cosseno, convenção do eixo Y da tela e rotação simultânea com avanço.
- **Input:** entender snapshot lido pelo loop, `preventDefault`, reset em blur e detach ao sair da tela.
- **Snapshot de configuração:** saber explicar a cópia de objetos aninhados e como opções futuras podem passar config a `GameCanvas`.
- **Assets Pixi:** estudar textura compartilhada, `HTMLImageElement`, carregamento paralelo com falhas, TilingSprite, DPR versus CSS e integração futura de atlas.
- **Colisão geométrica:** revisar distância quadrática, normal, recuperação do centro coincidente, subpassos e por que o collider não segue toda a arte.
- **Renderização Pixi:** compreender stage, Graphics, Sprite, anchor central e chamada manual a `Application.render()`.
- **Tamanho do bundle:** o build atual avisa que o principal chunk minificado supera 500 kB; entender divisão de código para tratar isso quando o escopo permitir.
- **Envio de resultado:** hook de submissão está desconectado e fixture MSW não persiste. Definir fluxo de fim de partida e evitar duplicação em retries no momento de integrar.
- **Acessibilidade e responsividade:** loading/erro têm roles e a área mantém proporção 8:5; ainda revisar foco e testar vários tamanhos de tela.
- **Autoria do código atual:** não foi possível identificar se as partes preexistentes foram feitas manualmente, com Codex, Trae ou em colaboração. Registrar a origem corretamente quando houver informação, sem reescrever a história.
