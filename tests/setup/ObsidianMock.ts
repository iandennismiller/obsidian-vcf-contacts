import { vi } from 'vitest';

const NoticeConstructorSpy = vi.fn();

class NoticeMock {
  noticeEl = {} as HTMLElement;
  containerEl = {} as HTMLElement;
  messageEl = {} as HTMLElement;
  constructor(message: string | DocumentFragment, duration?: number) {
    NoticeConstructorSpy(message, duration);
  }
  setMessage(message: string | DocumentFragment) {
    return this;
  }
  hide() {}
}

vi.mock('obsidian', () => ({
  Notice: NoticeMock,
  Modal: vi.fn(),
}));

export { NoticeConstructorSpy };
