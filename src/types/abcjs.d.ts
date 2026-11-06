declare module 'abcjs' {
  const abcjs: any;
  export default abcjs;
  export const renderAbc: (element: HTMLElement | string, abcNotation: string, options?: any) => any[];
  export const synth: any;
  export const timingCallbacks: any;
  export const midi: any;
}
