# Modelo padrão do avatar (Photoshop)

Abra **`modelo_avatar.psd`** no Photoshop. Tudo que você desenhar nele entra no jogo exportando cada camada como PNG.

## A grade

Canvas de **384 × 560 px** = 6 colunas × 5 linhas de células de **64 × 112 px**.

| | parado | andar 1 | andar 2 | andar 3 | andar 4 | sentado |
|---|---|---|---|---|---|---|
| **frente** | | | | | | |
| **frente 3/4** (olhando para baixo-**esquerda**) | | | | | | |
| **perfil** (olhando para a **direita**) | | | | | | |
| **costas 3/4** (de costas, virado para cima-**esquerda**) | | | | | | |
| **costas** | | | | | | |

As outras 3 direções o jogo cria **espelhando** (frente 3/4 → direita, perfil → esquerda, costas 3/4 → direita). Não desenhe nada que dependa de lado (ex.: um broche só no ombro direito), porque ele troca de lado no espelho.

## As guias (camada GUIAS)

| Guia | Posição na célula | Para quê |
|---|---|---|
| ✚ rosa | (32, 104) | **Âncora: os pés tocam aqui.** A última linha de pixels do sapato fica em y = 103. |
| vermelha | y = 104 | chão |
| laranja | y = 100 | topo dos sapatos |
| verde | y = 81 | cintura (fim do tronco / começo da calça) |
| azul | y = 49 | pescoço |
| roxa | y = 26 | topo da cabeça |
| ciano pontilhada | x = 32 | eixo central |

O personagem tem ~79 px de altura; chapéus e cabelos altos podem passar da guia roxa (há espaço até o topo da célula).

## As camadas

De baixo para cima (é a ordem em que o jogo empilha):

| Camada | Exporte como | Observação |
|---|---|---|
| `corpo` | `src/game/pack/avatar/corpo.png` | Pele em **#FDC996** (o jogo troca o tom de pele preservando sombras que você desenhar). Já vem copiado em todos os quadros: **ajuste as pernas e braços nos quadros "andar"**. |
| `sapato` | `src/game/pack/avatar/sapato/<id>.png` | |
| `calca` | `src/game/pack/avatar/calca/<id>.png` | |
| `roupa` | `src/game/pack/avatar/roupa/<id>.png` | |
| `cabelo` | `src/game/pack/avatar/cabelo/<id>.png` | |
| `chapeu` | `src/game/pack/avatar/chapeu/<id>.png` | |
| `REFERENCIA` | — (não exportar) | Seu boneco original, transparente, para decalcar. |
| `GUIAS` | — (não exportar) | **Oculte antes de exportar.** |

Cada peça é um **arquivo com a grade inteira** (384 × 560), transparente onde não há nada. Para criar várias roupas, duplique a camada `roupa` (ex.: `roupa_terno`) e exporte cada uma com o seu nome.

### Cores: tingíveis ou fixas

- **Tingível** (`"tint": true` no pack.json): desenhe em **tons de cinza** + contorno preto. O jogo multiplica pela cor que o jogador escolher (cinza claro = cor viva, cinza escuro = sombra; preto continua preto).
- **Cor fixa** (`"tint": false`): desenhe com as cores finais (ex.: uma coroa dourada).

### Quadros

- **parado**: obrigatório.
- **andar 1–4**: ciclo de caminhada (perna da frente → pernas juntas → outra perna → pernas juntas). Se um quadro ficar **vazio**, o jogo usa o "parado" daquela peça — e, se o corpo não tiver passos, faz um balanço de 1 px. Dá para começar só com "parado" e desenhar os passos depois.
- **sentado**: o jogo encaixa os **joelhos na altura do assento** (a âncora). Canelas e sapatos ficam escondidos — por isso a camada de sapato pode ficar vazia nessa coluna.

## Exportar do Photoshop

1. Oculte `GUIAS` e `REFERENCIA`.
2. *Arquivo → Exportar → Camadas para arquivos…* (formato **PNG-24 com transparência**), ou selecione a camada e *Exportar como…* PNG.
3. Salve no caminho da tabela acima e cadastre a peça em `src/game/pack/pack.json`:

```json
{ "slot": "roupa", "id": "terno", "name": "Terno", "file": "avatar/roupa/terno.png", "tint": true,
  "unlock": { "type": "achievement", "id": "mes_azul", "label": "No Azul" } }
```

`slot`: `roupa`, `calca`, `sapato`, `cabelo` ou `chapeu`. `unlock`: `default`, `level` ou `achievement` (ids em `docs/ASSETS.md`).

4. Rode `npm test`: ele confere se o PNG tem o tamanho da grade e se os pés estão na âncora.

## Regerar o modelo

`python tools/avatar/gerar_modelo.py` recria o PSD, as guias e as peças iniciais a partir de `base_original.png`.
Cuidado: isso **sobrescreve** `src/game/pack/avatar/corpo.png` e as peças iniciais (`camisa`, `padrao`, `tenis`, `curto`).
