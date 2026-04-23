export {};

declare global {
  interface Window {
    Desmos?: DesmosApi;
  }

  type DesmosApi = {
    enabledFeatures?: Partial<Record<DesmosFeatureName, boolean>>;
    Calculator?: (
      element: HTMLElement,
      options?: DesmosGraphingCalculatorOptions,
    ) => DesmosGraphingCalculator;
    GraphingCalculator: (
      element: HTMLElement,
      options?: DesmosGraphingCalculatorOptions,
    ) => DesmosGraphingCalculator;
    ScientificCalculator?: (
      element: HTMLElement,
      options?: DesmosScientificCalculatorOptions,
    ) => DesmosScientificCalculatorApi;
  };

  type DesmosFeatureName =
    | "GraphingCalculator"
    | "ScientificCalculator"
    | "FourFunctionCalculator"
    | "GeometryCalculator"
    | "Calculator3D";

  type DesmosGraphingCalculatorOptions = {
    autosize?: boolean;
    border?: boolean;
    expressions?: boolean;
    expressionsCollapsed?: boolean;
    folders?: boolean;
    invertedColors?: boolean;
    keypad?: boolean;
    notes?: boolean;
    projectorMode?: boolean;
    settingsMenu?: boolean;
    sliders?: boolean;
    zoomButtons?: boolean;
  };

  type DesmosScientificCalculatorOptions = {
    autosize?: boolean;
    border?: boolean;
    invertedColors?: boolean;
    keypad?: boolean;
  };

  type DesmosChangeEvent = {
    isUserInitiated: boolean;
  };

  type DesmosExpressionState = {
    id?: string;
    latex: string;
  };

  type DesmosState = unknown;

  type DesmosBaseCalculator = {
    destroy: () => void;
    resize: () => void;
    updateSettings?: (
      options: Partial<DesmosGraphingCalculatorOptions & DesmosScientificCalculatorOptions>,
    ) => void;
  };

  type DesmosGraphingCalculator = {
    destroy: () => void;
    getState: () => DesmosState;
    observeEvent: (
      event: "change",
      callback: (eventName: "change", event: DesmosChangeEvent) => void,
    ) => void;
    resize: () => void;
    setBlank: (options?: { allowUndo?: boolean }) => void;
    setExpression: (expression: DesmosExpressionState) => void;
    setMathBounds: (bounds: {
      left: number;
      right: number;
      bottom: number;
      top: number;
    }) => void;
    setState: (
      state: DesmosState,
      options?: { allowUndo?: boolean; remapColors?: boolean },
    ) => void;
    unobserveEvent: (event: "change") => void;
  } & DesmosBaseCalculator;

  type DesmosScientificCalculatorApi = DesmosBaseCalculator;
}
