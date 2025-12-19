import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function LatexWrapper({ children }: { children: string }) {
    return (
        <span className="latex-content">
            <Latex>{children}</Latex>
        </span>
    );
}
