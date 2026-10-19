/// <reference types="vite/client" />

declare module 'mammoth/mammoth.browser' {
  import mammoth = require('mammoth');
  export = mammoth;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
