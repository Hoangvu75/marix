declare module 'html2canvas' {
  interface Options {
    backgroundColor?: string | null;
    scale?: number;
    logging?: boolean;
    useCORS?: boolean;
    allowTaint?: boolean;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
    windowWidth?: number;
    windowHeight?: number;
    foreignObjectRendering?: boolean;
    onclone?: (document: Document) => void;
    ignoreElements?: (element: Element) => boolean;
    proxy?: string;
    removeContainer?: boolean;
    imageTimeout?: number;
    canvas?: HTMLCanvasElement;
  }

  function html2canvas(
    element: HTMLElement,
    options?: Options
  ): Promise<HTMLCanvasElement>;

  export default html2canvas;
}
