/** Importar archivos Markdown como texto: `import md from "./x.md?raw"`. */
declare module "*.md?raw" {
  const content: string;
  export default content;
}
