## 0.2.2 — Loja pelo token para jogadores

- Um clique esquerdo simples no token visível do negociante abre sua loja pública, com a ferramenta de tokens ativa.
- Não exige abrir o painel do QUEDAÇO nem acesso de observador à ficha completa. A loja precisa estar ativada e liberada pela Mestra.
- Cliques com modificadores, tokens ocultos, lojas fechadas e controles da Mestra preservam seu comportamento.
- Compras e vendas continuam exigindo uma ficha própria e aprovação da Mestra conectada.
- ZIP usa caminhos compatíveis com hospedagem Linux.

Validação: 12 testes automatizados passaram; pacote conferido. Clique e transação com usuário jogador ainda precisam ser conferidos no Foundry 13. Funciona sem o QUEDAÇO principal.

---

Primeira versão independente do Quedaço NPCs de venda, para Foundry VTT 13 e Skyfall 1.0.1.

- Ícone discreto de comerciante nas fichas, com ativação pela Mestra.
- Estoque separado do inventário, preenchido por arrastar itens.
- Preços e quantidades configuráveis, incluindo estoque ilimitado.
- Carrinho de compra e venda dos itens do personagem para a loja.
- Pedidos de jogadores confirmados pela Mestra, com registro privado no chat.
- Não requer nem altera o módulo QUEDAÇO.

Instale usando o manifest: https://github.com/yurisatelite/quedaco-npcs-de-venda/releases/latest/download/module.json

Validação: 8 testes automatizados passaram, sintaxe e pacote conferidos. Ainda requer conferência visual e funcional dentro de uma sessão Foundry. A Mestra precisa estar conectada para transações. Sem restock, serviços ou barganha automática nesta versão.
