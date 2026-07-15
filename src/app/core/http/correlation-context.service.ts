import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CorrelationContextService {
  private flowId: string | null = null;

  beginFlow(): string {
    this.flowId = crypto.randomUUID();
    return this.flowId;
  }

  endFlow(): void {
    this.flowId = null;
  }

  getCurrent(): string | null {
    return this.flowId;
  }
}
