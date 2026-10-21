# QUEDAÇO - NPCs de venda

Módulo independente para Foundry VTT 13 e Skyfall 1.0.1. Não requer QUEDAÇO.

Instalação: use o manifest https://github.com/yurisatelite/quedaco-npcs-de-venda/releases/latest/download/module.json no instalador de módulos do Foundry e ative no mundo.

Na barra superior de qualquer ficha Skyfall, a Mestra encontra o ícone de loja. Ative o modo comerciante, configure os multiplicadores e libere para jogadores. A ficha mantém seu tipo e inventário pessoal. O estoque da loja fica separado, em flags do módulo.

Abra a loja e arraste itens de compêndios ou fichas para adicionar mercadorias. No botão Estoque, edite preços em Trocados, quantidades e remoções. Quantidade -1 significa ilimitado. Preço de venda × 1 preserva tabela; Revenda × 0,5 oferece metade. Esses valores são ajustáveis, sem aplicação automática de habilidades ou pechincha.

O jogador abre a loja com um clique esquerdo simples no token visível do comerciante, com a ferramenta de tokens ativa. O modo comerciante e a opção de liberar a loja precisam estar ligados. Esse caminho não exige propriedade nem acesso de observador à ficha e não abre o painel do QUEDAÇO. Cliques com teclas modificadoras preservam as operações normais do Foundry; tokens ocultos e lojas fechadas não abrem. O ícone da loja na ficha continua disponível para quem tem acesso à ficha. O jogador precisa possuir uma ficha com moedas. Escolha o personagem, selecione quantidades e compre o carrinho ou venda itens. A Mestra ativa confirma pedidos de jogadores; as alterações são executadas por ela, sem dar permissão de edição do comerciante ao jogador. A venda incorpora os itens ao estoque. O comerciante tem caixa ilimitado nesta versão. Transações são processadas em fila e incluem recuperação compensatória quando há falha.

Interação de token: `src/token-shop.mjs` escuta `pointertap` no stage do canvas, converte coordenadas pelo `toLocal` e consulta `Token.isVisible` e `bounds`. Usa o Actor do token, inclusive sintético. Os hooks `canvasReady`/`canvasTearDown` registram e removem o listener; a Mestra mantém os controles normais. Testes Node cobrem seleção, zoom, lojas fechadas, invisibilidade e limpeza. Ainda é necessário conferir clique e compra com usuário jogador no Foundry 13, inclusive tokens não vinculados e outros módulos de interação.

Limitações: sem restock automático, serviços, barganha automática ou exigência de distância. Tokens não vinculados usam seu próprio Actor e estoque. Não há migração automática do estoque do QUEDAÇO. Não altere moedas e estoque manualmente enquanto uma transação estiver sendo confirmada. Dois mundos abertos em clientes diferentes devem manter só uma sessão da Mestra responsável.

API opcional: `game.modules.get('quedaco-npcs-de-venda').api.open(actor)`.

Desenvolvimento: `npm test` e `npm run package`. O pacote instalável fica em `dist/`.

## Referência técnica

Schema conferido no Skyfall local: moeda do personagem `system.currency.{k,p,t}`; 1 K = 1000 T, 1 P = 10 T. Mercadorias usam `system.price` inteiro em T e `system.quantity`. Tipos suportados: weapon, armor, clothing, equipment, consumable e loot. Fichas V2 são acessadas pelo hook `renderActorSheetV2`; V1 pelo `renderActorSheet`. Interface construída com DialogV2. Dados próprios em `flags.quedaco-npcs-de-venda.shop`; transporte pelo socket do módulo, com confirmação explícita da Mestra e validação de propriedade do comprador.

Versão 0.1.0: primeira versão. Verificação em Node e do pacote; validação visual e funcional em uma sessão Foundry ainda necessária.

## Protocolo de Integração QUEDAÇO (0.2.0)

- id `quedaco-npcs-de-venda`, `contractVersion` 1, evento `quedaco:register`.
- Capabilities: `merchantMode`, `shopInterface`, `tradeApproval`.
- Métodos públicos: `open(actor|id)` (abre a loja do NPC ou do token selecionado), `openShop`, `configure` (Mestra), `getStatus` (somente leitura; a contagem de mercadores só aparece para a Mestra).
- O QUEDAÇO principal reconhece os vendedores lendo a flag do módulo (somente leitura). Sem ele, tudo continua funcionando.
