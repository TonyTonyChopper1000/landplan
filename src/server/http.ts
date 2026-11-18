export type Req = {
  method: string;
  path: string; // without the /v1 prefix
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body: unknown;
  ip: string;
};

export type Writer = (chunk: string) => void;
export type Res =
  | { status: number; headers?: Record<string, string>; json: unknown }
  | { status: number; headers?: Record<string, string>; text: string; contentType: string }
  | { status: number; headers?: Record<string, string>; stream: (write: Writer) => Promise<void>; contentType: string };

/** RFC 7807 problem details. */
export class Problem extends Error {
  constructor(public status: number, public title: string, public detail?: string, public extra: Record<string, unknown> = {}) {
    super(detail ?? title);
  }
  toJSON() {
    return { type: `https://landplan.studio/problems/${this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title: this.title, status: this.status, detail: this.detail, ...this.extra };
  }
}

export const json = (status: number, body: unknown, headers?: Record<string, string>): Res => ({ status, json: body, headers });
