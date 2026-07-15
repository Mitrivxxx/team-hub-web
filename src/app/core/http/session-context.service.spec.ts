import { TestBed } from '@angular/core/testing';

import { SessionContextService } from './session-context.service';

describe('SessionContextService', () => {
  let service: SessionContextService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionContextService);
  });

  it('should create and persist a session id', () => {
    const first = service.getOrCreate();
    const second = service.getOrCreate();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(sessionStorage.getItem('team-hub-session-id')).toBe(first);
  });

  it('should sync session id from response header', () => {
    service.syncFromResponse('server-session-id');

    expect(service.getOrCreate()).toBe('server-session-id');
    expect(sessionStorage.getItem('team-hub-session-id')).toBe('server-session-id');
  });

  it('should ignore empty response header', () => {
    service.getOrCreate();
    service.syncFromResponse(null);

    expect(sessionStorage.getItem('team-hub-session-id')).toBeTruthy();
  });
});
