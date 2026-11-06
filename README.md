# ChatRooms

Chat com salas que conversa entre abas e janelas do mesmo navegador usando `BroadcastChannel`, com histórico de mensagens por sala salvo em `localStorage`, presença de usuários e indicador de "digitando". Não há servidor.

A ideia é demonstrar comunicação em tempo real e o raciocínio de um sistema distribuído em miniatura: várias "instâncias" (abas) sem memória compartilhada, que precisam concordar sobre quem está online, o que foi dito e o que é válido.

## Por que este projeto

Chats, notificações e colaboração em tempo real estão em quase todo produto moderno. Mesmo sem WebSocket, o problema central é o mesmo: definir um protocolo, validar o que chega, evitar duplicatas e manter presença. Pontos que o projeto exercita:

- protocolo com envelope versionado (`v`, `type`, `tabId`, `payload`) e validação de tudo que chega pelo canal;
- idempotência: mensagens têm id único e o histórico ignora duplicatas;
- presença por heartbeat com expiração (TTL), o mesmo mecanismo de sistemas reais;
- segurança básica: o texto das mensagens nunca é interpretado como HTML (só `textContent`), então não há XSS entre abas;
- injeção de dependência (`ChannelCtor`) para testar o barramento em Node sem navegador.

## Recursos

- Três salas (`general`, `random`, `help`) com histórico persistente (até 200 mensagens por sala).
- Mensagens instantâneas entre todas as abas abertas; cada aba pode usar um nome diferente.
- Presença: lista de pessoas na sala e total de usuários online, atualizada por heartbeat a cada 3 s; abas fechadas saem da lista ao fechar ou após 8 s sem sinal.
- Indicador "fulano está digitando".
- Contador de mensagens não lidas por sala.
- `Enter` envia, `Shift+Enter` quebra linha; limite de 500 caracteres por mensagem.
- Cores estáveis por nome, layout responsivo e região `aria-live` na lista de mensagens.

## Como executar

Abra o `index.html` em **duas ou mais abas** do mesmo navegador (o `BroadcastChannel` só liga abas da mesma origem). Informe um nome em cada aba e converse. Também é possível usar um servidor local, o que garante que todas as abas tenham a mesma origem:

```bash
python3 -m http.server 8000
# abra http://localhost:8000 em duas abas
```

## Como testar

Dentro desta pasta, com Node 18 ou superior:

```bash
node --test
```

Os testes cobrem o protocolo (sanitização, validação, envelopes hostis), o histórico (ordem, deduplicação, limite, JSON corrompido, falha de quota), a presença (TTL, abas repetidas, indicadores de digitação) e o barramento. Para o barramento há um `BroadcastChannel` falso em memória, que permite checar entrega a outros, descarte do eco e payloads inválidos, além de um teste com o `BroadcastChannel` real do Node.

## Decisões de projeto

- **Só quem envia grava no histórico.** Se todas as abas gravassem cada mensagem recebida, haveria condições de corrida de leitura-modificação-escrita na mesma chave do `localStorage`. Gravar apenas na aba de origem evita isso, e a deduplicação por id protege contra casos residuais.
- **Presença por heartbeat.** Cada aba anuncia a si mesma a cada 3 s; quem ficar 8 s sem sinal é considerado offline. Um evento `leave` no `pagehide` acelera a saída. Quando uma aba nova aparece, as demais respondem, para que ela descubra quem já estava lá sem esperar o próximo ciclo.
- **Validação na borda.** `parseEnvelope` descarta qualquer coisa fora do formato esperado. Isso importa porque qualquer script na mesma origem pode postar no canal.
- **Histórico com teto.** O `localStorage` tem cota (cerca de 5 MB); limitar a 200 mensagens por sala mantém o uso previsível. Quando a escrita falha, o chat continua funcionando ao vivo.
- **Complexidade.** Anexar uma mensagem é O(n log n) no tamanho do histórico da sala por causa da ordenação, com n ≤ 200; presença e digitação são O(abas).
- **Escopo local.** `BroadcastChannel` só funciona dentro de um navegador, em uma origem. Trocá-lo por WebSocket exigiria alterar apenas `bus.js`, mantendo o protocolo.

## Estrutura de pastas

```
ChatRooms/
├── index.html
├── style.css
├── src/
│   ├── app.js        # interface e integração
│   ├── protocol.js   # mensagens, envelopes e validação
│   ├── history.js    # histórico por sala em localStorage
│   ├── presence.js   # presença e digitação
│   └── bus.js        # wrapper do BroadcastChannel
├── tests/
├── package.json
├── LICENSE
└── README.md
```

## Limitações conhecidas

- Funciona apenas entre abas do mesmo navegador e da mesma origem; não há comunicação entre dispositivos.
- Não há autenticação: qualquer aba pode usar qualquer nome, inclusive o de outra pessoa.
- Quem abre uma sala só vê o histórico salvo no `localStorage` daquele navegador.
- Não há edição, exclusão nem reações a mensagens.
- Sem ordenação causal rigorosa: mensagens são ordenadas pelo relógio local de quem envia.
- `app.js` não tem testes automatizados; a lógica testável está nos demais módulos.

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE).
