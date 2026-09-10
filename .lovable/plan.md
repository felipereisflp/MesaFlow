# SaaS de pedidos por NFC para bares e restaurantes — MVP

Sistema multi-estabelecimento onde o cliente encosta o celular na tag da mesa, abre o cardápio sem login e faz o pedido; cozinha, bar e caixa acompanham tudo em tempo real. Visual azul e branco, dinâmico, pensado para telas de operação.

## Etapas

### Etapa 1 — Base e acesso da equipe
- Banco de dados e login por e-mail/senha (Lovable Cloud).
- Cadastro do estabelecimento: nome, logo, cores, fuso, taxa de serviço.
- Perfis: Dono, Admin, Gerente, Caixa, Garçom, Cozinha, Bar, Auditor. Permissões conferidas no servidor, nunca só escondendo botões na tela.
- Página inicial pública apresentando o produto + entrada para login.

### Etapa 2 — Cardápio e mesas
- Categorias, produtos, variações e adicionais; foto, preço, disponibilidade, estação (cozinha ou bar).
- Produto some da vitrine sem apagar histórico.
- Mesas: nome de exibição, setor, capacidade.
- Geração de tag NFC/QR por mesa: link com código aleatório e imprevisível, com botões de girar código e revogar. Tela de impressão do QR.

### Etapa 3 — Vitrine do cliente (sem login)
- Ao abrir o link da mesa: valida o código, confere se a mesa e o estabelecimento estão ativos, abre ou reaproveita a comanda daquela mesa e cria uma sessão curta para aquele celular.
- Cardápio, carrinho, envio de pedido, acompanhamento do status e total da conta em tempo real.
- Limite de tentativas por código e registro de cada toque para segurança.

### Etapa 4 — Pedidos e painéis de operação
- Um pedido misto gera comandas separadas para cozinha e bar, cada uma com seu próprio andamento (recebido, em preparo, pronto, entregue).
- Painéis de cozinha e bar: fila por tempo de espera, alerta de atraso, botão único por etapa.
- Painel de salão/garçom: mesas, contas abertas, transferência de mesa.
- Atualização em tempo real; a tela sempre reconfere o estado no servidor ao reconectar.

### Etapa 5 — Caixa, fechamento e auditoria
- Caixa: mesas abertas, total, descontos, taxa de serviço, divisão de conta, pagamentos parciais.
- Nesta fase o pagamento é registrado manualmente pelo caixa (dinheiro, Pix, cartão na maquininha). Integração automática com provedor fica para a próxima fase, mantendo a estrutura pronta.
- Mesa só é liberada com saldo zerado; liberar com saldo devedor exige perfil Gerente e justificativa registrada.
- Trilha de auditoria: quem fez o quê, quando, motivo, estado antes e depois, encadeada por hash.
- Alertas simples de risco (conta alta e parada há muito tempo) apenas como aviso ao caixa/gerente, nunca ação automática.

## Detalhes técnicos

- TanStack Start + Lovable Cloud (Postgres, auth, storage).
- Isolamento por estabelecimento com RLS em todas as tabelas; o identificador do estabelecimento nunca vem do navegador, é derivado da sessão no servidor.
- Papéis em tabela separada (`user_roles`) com função `has_role` security definer; nunca no perfil do usuário.
- Máquina de estados da comanda: OPEN → ORDERING → PAYMENT_PENDING → PARTIALLY_PAID → PAID → CLOSED, com CANCELLED só via Gerente+ e motivo. Índice único garantindo uma comanda ativa por mesa; travamento otimista por coluna `version`.
- Token da tag: 128 bits via CSPRNG, versionado, com rotação e revogação idempotentes; o código amigável da mesa é só rótulo interno.
- Chave de idempotência obrigatória na criação de comanda, envio de pedido e início de pagamento.
- Cada item do pedido guarda cópia imutável de nome, preço e adicionais.
- Rotas públicas de resolução de token sob `/api/public/*` com validação de formato e limite de tentativas; lógica interna em server functions.
- Tempo real por Realtime do Cloud, com reconciliação completa ao reconectar.

## Fora de escopo (conforme o documento)

Nada de travas físicas, catracas, reconhecimento facial, lista de inadimplentes entre estabelecimentos ou qualquer retenção do cliente. Emissão fiscal fica para fase futura, via integração.

## O que ainda precisarei de você

Nome do produto/estabelecimento de exemplo, logo e um cardápio real (ou uso dados fictícios claramente marcados até você enviar).
