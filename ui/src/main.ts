import './prism'; // 他のインポートより必ず先に行う
import './styles/app.css';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'prismjs/themes/prism.css';

const app = createApp(App);
app.use(router).mount('#app');
