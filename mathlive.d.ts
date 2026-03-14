import * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        onInput?: (e: any) => void;
        value?: string;
        ref?: any;
      };
    }
  }
}
