declare module 'troika-three-text' {
  import type { Mesh, Color } from 'three';
  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    anchorX: number | string;
    anchorY: number | string;
    color: string | number | Color;
    fillOpacity: number;
    outlineWidth: number | string;
    outlineColor: string | number | Color;
    maxWidth: number;
    textAlign: string;
    sync(cb?: () => void): void;
    dispose(): void;
  }
  export class BatchedText extends Text {
    addText(t: Text): void;
    removeText(t: Text): void;
  }
}
