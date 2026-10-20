import './styles.css';
import { App } from './app/App';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('找不到应用入口');

new App(root);
