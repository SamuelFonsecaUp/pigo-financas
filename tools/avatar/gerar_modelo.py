"""
Gera o MODELO PADRÃO do avatar para desenhar no Photoshop e as peças iniciais do pacote oficial.

Uso (na raiz do projeto):  python tools/avatar/gerar_modelo.py

Saídas:
  design/avatar/modelo_avatar.psd     camadas: GUIAS, REFERENCIA, chapeu, cabelo, roupa, calca, sapato, corpo
  design/avatar/modelo_guias.png      só as guias (para quem não usa Photoshop)
  design/avatar/modelo_referencia.png boneco base posicionado na grade
  src/game/pack/avatar/corpo.png      corpo base na grade (lido pelo app)
  src/game/pack/avatar/<slot>/<id>.png peças iniciais em cinza (o app tinge com a cor escolhida)

Grade: 6 colunas (quadros) x 5 linhas (vistas), células de 64 x 112 px.
O pé do personagem fica no ponto (32, 104) de cada célula.
"""
import os
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCE = os.path.join(ROOT, 'design', 'avatar', 'base_original.png')
DESIGN = os.path.join(ROOT, 'design', 'avatar')
PACK = os.path.join(ROOT, 'src', 'game', 'pack', 'avatar')

CELL_W, CELL_H = 64, 112
ANCHOR_X, ANCHOR_Y = 32, 104  # pé: última linha de pixels do sapato fica em y = 103
VIEWS = ['frente', 'frente_34', 'perfil', 'costas_34', 'costas']
FRAMES = ['parado', 'andar_1', 'andar_2', 'andar_3', 'andar_4', 'sentado']
# ordem das vistas na imagem original enviada (costas, perfil, frente, 3/4 frente, 3/4 costas)
SOURCE_ORDER = ['costas', 'perfil', 'frente', 'frente_34', 'costas_34']
# para que lado o rosto aponta em cada vista (define o "lado de trás" da cabeça para o cabelo)
FACE = {'frente': 'centro', 'frente_34': 'esquerda', 'perfil': 'direita', 'costas_34': 'nenhum', 'costas': 'nenhum'}
SKIN_KEY = (253, 201, 150)
TINT_GRAY = (214, 214, 214)
TINT_SHADE = (176, 176, 176)
W, H = CELL_W * len(FRAMES), CELL_H * len(VIEWS)


# ---------------------------------------------------------------- leitura da base
def load_figures():
    img = Image.open(SOURCE).convert('RGBA')
    w, h = img.size
    px = img.load()

    def empty(x, y):
        r, g, b, a = px[x, y]
        return a < 16 or (r, g, b) == (255, 255, 255)

    cols = [any(not empty(x, y) for y in range(h)) for x in range(w)]
    ranges, start = [], None
    for x, c in enumerate(cols + [False]):
        if c and start is None:
            start = x
        if not c and start is not None:
            ranges.append((start, x - 1))
            start = None
    figures = {}
    for view, (x0, x1) in zip(SOURCE_ORDER, ranges):
        ys = [y for y in range(h) if any(not empty(x, y) for x in range(x0, x1 + 1))]
        top, bottom = ys[0], ys[-1]
        fw, fh = x1 - x0 + 1, bottom - top + 1
        fig = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        for y in range(fh):
            for x in range(fw):
                if not empty(x0 + x, top + y):
                    fig.putpixel((x, y), px[x0 + x, top + y][:3] + (255,))
        figures[view] = fig
    return figures


def kind(rgba):
    r, g, b, a = rgba
    if a == 0:
        return 'vazio'
    if abs(r - SKIN_KEY[0]) + abs(g - SKIN_KEY[1]) + abs(b - SKIN_KEY[2]) < 60:
        return 'pele'
    if 0.299 * r + 0.587 * g + 0.114 * b < 70:
        return 'contorno'
    return 'outro'


def regions(fig):
    """Linhas do corpo medidas na própria vista (o pescoço é a linha mais estreita abaixo da cabeça)."""
    fw, fh = fig.size
    widths = []
    for y in range(fh):
        xs = [x for x in range(fw) if fig.getpixel((x, y))[3]]
        widths.append((max(xs) - min(xs) + 1) if xs else 0)
    head_top = 0
    feet = fh - 1
    lo, hi = head_top + 16, min(head_top + 34, fh - 1)
    neck = min(range(lo, hi), key=lambda y: (widths[y], -y))
    shoulder = next((y for y in range(neck + 1, fh) if widths[y] >= widths[neck] + 6), neck + 2)
    waist = feet - 22  # primeira linha da calça
    return {'head_top': head_top, 'neck': neck, 'shoulder': shoulder, 'waist': waist, 'feet': feet}


def runs(fig, y):
    fw = fig.size[0]
    out, s = [], None
    for x in range(fw + 1):
        filled = x < fw and kind(fig.getpixel((x, y))) == 'pele'
        if filled and s is None:
            s = x
        if not filled and s is not None:
            out.append((s, x - 1))
            s = None
    return out


def head_component(fig, r):
    """Pixels de pele ligados à cabeça sem atravessar contorno (o queixo pode descer sobre os ombros)."""
    fw, fh = fig.size
    xs = [x for x in range(fw) if fig.getpixel((x, r['head_top'] + 10))[3]]
    start = ((min(xs) + max(xs)) // 2, r['head_top'] + 10)
    if kind(fig.getpixel(start)) != 'pele':
        start = next(((x, start[1]) for x in xs if kind(fig.getpixel((x, start[1]))) == 'pele'), start)
    seen, stack = set(), [start]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < fw and 0 <= y < fh) or kind(fig.getpixel((x, y))) != 'pele':
            continue
        seen.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # Se o rosto não é fechado por contorno (vistas de lado/costas), a região "vaza" para o tronco:
    # nesse caso vale só a parte acima dos ombros.
    if seen and max(y for _, y in seen) > r['shoulder'] + 8:
        return {(x, y) for x, y in seen if y < r['shoulder'] - 1}
    return seen


# ---------------------------------------------------------------- peças iniciais (máscaras na vista)
def make_part(fig, view, slot, style):
    """Retorna uma imagem do tamanho da figura com a peça em cinza (tingível) e contorno preto."""
    fw, fh = fig.size
    r = regions(fig)
    part = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))

    def put(x, y, shade=False):
        k = kind(fig.getpixel((x, y)))
        if k == 'vazio':
            return
        part.putpixel((x, y), (0, 0, 0, 255) if k == 'contorno' else (TINT_SHADE if shade else TINT_GRAY) + (255,))

    if slot == 'roupa':
        face = head_component(fig, r)
        for y in range(r['shoulder'] - 1, r['waist']):
            for x in range(fw):
                if (x, y) not in face:
                    put(x, y)
        # sombra suave na lateral direita do tronco
        for y in range(r['shoulder'], r['waist']):
            xs = [x for x in range(fw) if kind(fig.getpixel((x, y))) == 'pele']
            if xs:
                for x in xs[-3:]:
                    put(x, y, shade=True)
    elif slot == 'calca':
        for y in range(r['waist'], fh):
            rs = runs(fig, y)
            body = max(rs, key=lambda t: t[1] - t[0]) if rs else None
            for x in range(fw):
                k = kind(fig.getpixel((x, y)))
                if k == 'vazio':
                    continue
                # mãos (corridas fora do corpo logo abaixo da cintura) ficam com a pele
                if y < r['waist'] + 4 and body and k == 'pele' and not (body[0] <= x <= body[1]):
                    continue
                # pés: as 3 últimas linhas de cada coluna são sapato
                col_bottom = max(yy for yy in range(fh) if fig.getpixel((x, yy))[3])
                if y > col_bottom - 3:
                    continue
                put(x, y)
    elif slot == 'sapato':
        for x in range(fw):
            ys = [y for y in range(fh) if fig.getpixel((x, y))[3]]
            if not ys or ys[-1] < r['feet'] - 8:
                continue
            for y in range(ys[-1] - 3, ys[-1] + 1):
                put(x, y)
    elif slot == 'cabelo' and style == 'curto':
        xs = [x for y in range(r['neck']) for x in range(fw) if fig.getpixel((x, y))[3]]
        cx = (min(xs) + max(xs)) / 2
        face = FACE[view]

        def back_side(x):
            return {'nenhum': True, 'direita': x < cx - 1, 'esquerda': x > cx + 1, 'centro': False}[face]

        for y in range(r['neck']):
            for x in range(fw):
                if kind(fig.getpixel((x, y))) == 'vazio':
                    continue
                hy = y - r['head_top']
                if hy <= 8 or (back_side(x) and hy <= 19) or (face == 'centro' and (x <= min(xs) + 3 or x >= max(xs) - 3) and hy <= 12):
                    put(x, y, shade=back_side(x) and hy > 10)
    return part


def sitting(img, waist):
    """Pose sentada: canelas escondidas (dobradas à frente do assento)."""
    out = img.copy()
    cut = waist + 9
    for y in range(cut + 1, out.size[1]):
        for x in range(out.size[0]):
            out.putpixel((x, y), (0, 0, 0, 0))
    for x in range(out.size[0]):
        if out.getpixel((x, cut))[3]:
            out.putpixel((x, cut), (0, 0, 0, 255))
    return out


def feet_center(fig, feet_row):
    fw = fig.size[0]
    xs = [x for y in range(max(0, feet_row - 3), feet_row + 1) for x in range(fw) if fig.getpixel((x, y))[3]]
    return (min(xs) + max(xs)) / 2 if xs else fw / 2


def place(sheet, fig, row, col, feet_row, cx=None):
    """Cola a figura na célula com os pés no ponto de âncora (cx = centro dos pés do CORPO)."""
    if cx is None:
        cx = feet_center(fig, feet_row)
    ox = col * CELL_W + ANCHOR_X - round(cx)
    oy = row * CELL_H + ANCHOR_Y - 1 - feet_row
    sheet.alpha_composite(fig, (ox, oy))


# ---------------------------------------------------------------- guias
def draw_guides():
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    font = ImageFont.load_default()
    for row, view in enumerate(VIEWS):
        for col, frame in enumerate(FRAMES):
            x0, y0 = col * CELL_W, row * CELL_H
            d.rectangle([x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1], outline=(200, 200, 200, 255))
            # linhas de referência (medidas a partir do pé)
            for dy, color in ((0, (230, 40, 40, 255)), (-4, (240, 150, 40, 160)), (-23, (60, 160, 60, 200)),
                              (-55, (60, 120, 220, 200)), (-78, (150, 80, 220, 200))):
                y = y0 + ANCHOR_Y + dy
                for x in range(x0 + 2, x0 + CELL_W - 2, 2):
                    g.putpixel((x, y), color)
            for y in range(y0 + 14, y0 + CELL_H - 2, 3):
                g.putpixel((x0 + ANCHOR_X, y), (40, 200, 220, 140))
            for k in range(-3, 4):
                g.putpixel((x0 + ANCHOR_X + k, y0 + ANCHOR_Y), (255, 0, 255, 255))
                g.putpixel((x0 + ANCHOR_X, y0 + ANCHOR_Y + k), (255, 0, 255, 255))
            d.text((x0 + 2, y0 + 1), frame.replace('_', ' '), fill=(90, 90, 90, 255), font=font)
            if col == 0:
                d.text((x0 + 2, y0 + CELL_H - 11), view.replace('_', ' '), fill=(30, 30, 160, 255), font=font)
    return g


# ---------------------------------------------------------------- PSD (camadas, compressão RLE)
def packbits(row):
    out, i, n = bytearray(), 0, len(row)
    while i < n:
        j = i
        while j + 1 < n and row[j + 1] == row[i] and j - i < 127:
            j += 1
        if j > i:
            out += bytes([257 - (j - i + 1), row[i]])
            i = j + 1
        else:
            j = i
            while j + 1 < n and (j + 2 >= n or row[j + 1] != row[j + 2]) and j - i < 127:
                j += 1
            out += bytes([j - i]) + bytes(row[i:j + 1])
            i = j + 1
    return bytes(out)


def channel_rle(img, idx):
    w, h = img.size
    data = img.tobytes()
    rows = [packbits(data[y * w * 4 + idx: (y + 1) * w * 4: 4]) for y in range(h)]
    return rows


def pascal(name):
    raw = name.encode('ascii')
    s = bytes([len(raw)]) + raw
    while len(s) % 4:
        s += b'\0'
    return s


def write_psd(path, layers):
    """layers: lista de (nome, Image RGBA, visível, opacidade 0-255) de BAIXO para CIMA."""
    records, channel_data = b'', b''
    for name, img, visible, opacity in layers:
        w, h = img.size
        chans = []
        for cid, idx in ((-1, 3), (0, 0), (1, 1), (2, 2)):
            rows = channel_rle(img, idx)
            payload = struct.pack('>H', 1) + b''.join(struct.pack('>H', len(r)) for r in rows) + b''.join(rows)
            chans.append((cid, payload))
        rec = struct.pack('>iiiiH', 0, 0, h, w, len(chans))
        for cid, payload in chans:
            rec += struct.pack('>hI', cid, len(payload))
        flags = 0 if visible else 0x02
        extra = struct.pack('>I', 0) + struct.pack('>I', 0) + pascal(name)
        rec += b'8BIMnorm' + struct.pack('>BBBB', opacity, 0, flags, 0) + struct.pack('>I', len(extra)) + extra
        records += rec
        channel_data += b''.join(p for _, p in chans)
    layer_info = struct.pack('>h', len(layers)) + records + channel_data
    if len(layer_info) % 2:
        layer_info += b'\0'
    layer_section = struct.pack('>I', len(layer_info)) + layer_info + struct.pack('>I', 0)
    # imagem composta (todas as camadas visíveis)
    merged = Image.new('RGBA', layers[0][1].size, (255, 255, 255, 255))
    for _, img, visible, opacity in layers:
        if visible:
            merged.alpha_composite(img)
    w, h = merged.size
    rows_all = []
    for idx in (0, 1, 2, 3):
        rows_all += channel_rle(merged, idx)
    merged_data = struct.pack('>H', 1) + b''.join(struct.pack('>H', len(r)) for r in rows_all) + b''.join(rows_all)
    header = b'8BPS' + struct.pack('>H6xHIIHH', 1, 4, h, w, 8, 3)
    with open(path, 'wb') as f:
        f.write(header)
        f.write(struct.pack('>I', 0))  # color mode data
        f.write(struct.pack('>I', 0))  # image resources
        f.write(struct.pack('>I', len(layer_section)) + layer_section)
        f.write(merged_data)


# ---------------------------------------------------------------- principal
def main():
    os.makedirs(DESIGN, exist_ok=True)
    figures = load_figures()

    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    body_psd = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    reference = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    parts = {
        ('roupa', 'camisa'): Image.new('RGBA', (W, H), (0, 0, 0, 0)),
        ('calca', 'padrao'): Image.new('RGBA', (W, H), (0, 0, 0, 0)),
        ('sapato', 'tenis'): Image.new('RGBA', (W, H), (0, 0, 0, 0)),
        ('cabelo', 'curto'): Image.new('RGBA', (W, H), (0, 0, 0, 0)),
    }
    for row, view in enumerate(VIEWS):
        fig = figures[view]
        r = regions(fig)
        feet = r['feet']
        cx = feet_center(fig, feet)
        sit = sitting(fig, r['waist'])
        # corpo do pacote: só "parado" e "sentado" (quadros de passo vazios = o app balança o corpo)
        place(body, fig, row, 0, feet, cx)
        place(body, sit, row, 5, r['waist'] + 9, cx)
        # corpo do PSD: cópia em todos os quadros como ponto de partida para desenhar os passos
        for col in range(5):
            place(body_psd, fig, row, col, feet, cx)
        place(body_psd, sit, row, 5, r['waist'] + 9, cx)
        ghost = fig.copy()
        ghost.putalpha(ghost.getchannel('A').point(lambda a: 90 if a else 0))
        for col in range(6):
            place(reference, ghost, row, col, feet, cx)
        for (slot, style), sheet in parts.items():
            p = make_part(fig, view, slot, style)
            place(sheet, p, row, 0, feet, cx)
            if slot != 'sapato':  # sentado: canelas e sapatos ficam escondidos
                place(sheet, sitting(p, r['waist']), row, 5, r['waist'] + 9, cx)

    guides = draw_guides()
    guides.save(os.path.join(DESIGN, 'modelo_guias.png'))
    reference.save(os.path.join(DESIGN, 'modelo_referencia.png'))

    os.makedirs(PACK, exist_ok=True)
    body.save(os.path.join(PACK, 'corpo.png'))
    for (slot, style), sheet in parts.items():
        os.makedirs(os.path.join(PACK, slot), exist_ok=True)
        sheet.save(os.path.join(PACK, slot, f'{style}.png'))

    blank = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    write_psd(os.path.join(DESIGN, 'modelo_avatar.psd'), [
        ('corpo', body_psd, True, 255),
        ('sapato', parts[('sapato', 'tenis')], True, 255),
        ('calca', parts[('calca', 'padrao')], True, 255),
        ('roupa', parts[('roupa', 'camisa')], True, 255),
        ('cabelo', parts[('cabelo', 'curto')], True, 255),
        ('chapeu', blank, True, 255),
        ('REFERENCIA', reference, False, 255),
        ('GUIAS', guides, True, 255),
    ])
    print('modelo gerado em', DESIGN)


if __name__ == '__main__':
    main()
