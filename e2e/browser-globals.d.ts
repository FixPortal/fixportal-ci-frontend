export {}

declare global {
  interface Window {
    __cls: number
    __clsObserver: PerformanceObserver
    fixtureInteractions: number[]
    fixtureInteractionObserver: PerformanceObserver
  }
}
