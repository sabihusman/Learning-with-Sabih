// Shared colour and font tokens for the topic visualisations. Every figure
// imports from here instead of declaring its own hexes, so the palette cannot
// drift. Colours mirror the custom properties in globals.css. Declared as one
// statement so the palette is not a repeated const-per-line block.
export const INK = '#1a1a1a',
  FADE = '#73716c',
  ACCENT = '#c0392b',
  ACCENT_SOFT = '#e3b7b1',
  ERR_BG = '#fbecea',
  OK = '#1f6f5c',
  OK_SOFT = '#9cc3ab',
  OK_BG = '#e6f2ec',
  BLUE = '#2f6f8f',
  BLUE_SOFT = '#b9c6d8',
  BLUE_BG = '#eef3f7',
  AMBER = '#b07a2e',
  AMBER_STROKE = '#caa24a',
  AMBER_BG = '#f6e7c8',
  PURPLE = '#8a5a83',
  RUST = '#a85632',
  OLIVE = '#5f7a4f',
  PAPER = '#f7f6f2',
  CARD = '#ffffff',
  PANEL = '#faf9f6',
  CONTROL_BG = '#f4f2ec',
  MUTED_BG = '#ece9e1',
  RULE = '#e2e0d8',
  LINE = '#d8d4cc',
  MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  SERIF = "Georgia, 'Times New Roman', serif"

// Identity colours for things that are merely different from each other
// (robots, disks, lanes, groups). Never use ACCENT as a category: it means
// error or emphasis everywhere else on the site.
export const CATEGORICAL = [BLUE, AMBER, OK, PURPLE, RUST, OLIVE]
