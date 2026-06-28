import Prism from 'prismjs';

(window as any).Prism = Prism;

// Plugins that depend on window.Prism
import 'prismjs/components/prism-json';
import 'prismjs/plugins/line-numbers/prism-line-numbers';

export default Prism;
