import { TestBed } from '@angular/core/testing';

import { CorrelationContextService } from './correlation-context.service';

describe('CorrelationContextService', () => {
  let service: CorrelationContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CorrelationContextService);
  });

  it('should return null when no flow is active', () => {
    expect(service.getCurrent()).toBeNull();
  });

  it('should reuse the same id within a flow', () => {
    const flowId = service.beginFlow();

    expect(flowId).toBeTruthy();
    expect(service.getCurrent()).toBe(flowId);
  });

  it('should clear the flow id on endFlow', () => {
    service.beginFlow();
    service.endFlow();

    expect(service.getCurrent()).toBeNull();
  });
});
