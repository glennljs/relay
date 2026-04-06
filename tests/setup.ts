import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock
});

if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    writable: true,
    configurable: true,
    value: () => false
  });

  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    writable: true,
    configurable: true,
    value: () => {}
  });

  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    writable: true,
    configurable: true,
    value: () => {}
  });

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    configurable: true,
    value: () => {}
  });
}
