import Phaser from 'phaser';
import { INK } from './hud';
import {
  CELL_H,
  CELL_W,
  CHARSET,
  glyphCell,
  glyphRows,
  GLYPHS_PER_ROW,
  splitBanner,
  TEXTURE_H,
  TEXTURE_W,
  TITLE_SCALE,
} from './pixel-font';

/**
 * The pixel font on screen. Each colour is baked into its own texture rather
 * than tinted, so the text looks the same under the canvas renderer, which
 * cannot tint bitmap text. Every glyph carries a one-pixel ink shadow down
 * and right, in the cell's spare column and row, so text reads over the
 * sunset as well as the night sky.
 */
export const TEXT_COLOR = '#f0f0e0';
const SHADOW_COLOR = '#101010';

/** The bitmap font key for `color`, drawing and registering it on first use. */
export function pixelFont(scene: Phaser.Scene, color = TEXT_COLOR): string {
  const key = `pixel-font-${color}`;
  if (scene.cache.bitmapFont.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, TEXTURE_W, TEXTURE_H);
  if (!texture) throw new Error(`could not create the ${key} texture`);
  const context = texture.getContext();
  for (const [fill, offset] of [
    [SHADOW_COLOR, 1],
    [color, 0],
  ] as const) {
    context.fillStyle = fill;
    for (const char of CHARSET) {
      const cell = glyphCell(char);
      glyphRows(char).forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          if (pixel === '#') context.fillRect(cell.x + x + offset, cell.y + y + offset, 1, 1);
        });
      });
    }
  }
  texture.refresh();
  // Parse returns the whole cache entry (data, texture, frame), whatever its typings say.
  const entry: unknown = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: key,
    'offset.x': 0,
    'offset.y': 0,
    width: CELL_W,
    height: CELL_H,
    chars: CHARSET,
    charsPerRow: GLYPHS_PER_ROW,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(key, entry);
  return key;
}

export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text = '',
  color = TEXT_COLOR,
): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(x, y, pixelFont(scene, color), text);
}

/**
 * A centre-screen card: a double-size title line, then the smaller body
 * that follows the blank line under it, centred as one block on `centreY`.
 */
export class PixelBanner {
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly body: Phaser.GameObjects.BitmapText;
  private text = '';

  constructor(
    scene: Phaser.Scene,
    private readonly centreX: number,
    private readonly centreY: number,
    depth: number,
  ) {
    this.title = pixelText(scene, centreX, 0)
      .setScale(TITLE_SCALE)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth);
    this.body = pixelText(scene, centreX, 0)
      .setCenterAlign()
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  setText(text: string): this {
    if (text === this.text) return this;
    this.text = text;
    const { title, body } = splitBanner(text);
    this.title.setText(title);
    this.body.setText(body);
    const titleH = title === '' ? 0 : CELL_H * TITLE_SCALE;
    const bodyH = body === '' ? 0 : CELL_H + this.body.height;
    const top = Math.round(this.centreY - (titleH + bodyH) / 2);
    this.title.setPosition(this.centreX, top);
    this.body.setPosition(this.centreX, top + titleH + (titleH === 0 ? 0 : CELL_H));
    return this;
  }
}

/** TOKEN's speech bubble: pixel text on an ink plate, anchored by `originX` along its bottom. */
export class PixelBubble {
  private readonly plate: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, originX: number, depth: number) {
    this.plate = scene.add.rectangle(0, 0, 1, 1, INK).setOrigin(0).setDepth(depth);
    this.label = pixelText(scene, 0, 0).setOrigin(originX, 1).setDepth(depth);
  }

  get width(): number {
    return this.label.width;
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setVisible(visible: boolean): this {
    this.plate.setVisible(visible);
    this.label.setVisible(visible);
    return this;
  }

  setPosition(x: number, y: number): this {
    const label = this.label.setPosition(Math.round(x), Math.round(y));
    const left = Math.round(label.x - label.width * label.originX);
    const top = label.y - label.height;
    // Two pixels of plate either side, one above the caps and one under the descenders.
    this.plate.setPosition(left - 2, top - 1).setSize(label.width + 3, label.height + 1);
    return this;
  }
}
