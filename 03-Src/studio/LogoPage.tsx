import {createRoot} from 'react-dom/client';
import LogoSettings from './LogoSettings';
import '../style.css';
import '../astra.css';
import './studio.css';
import './appearance.css';

createRoot(document.getElementById('root')!).render(<main className="logo-standalone"><header><div><h1>Logo 与动效</h1><span>造价智算</span></div><a className="btn btn-ghost btn-sm" href="/">返回系统</a></header><LogoSettings standalone/></main>);
